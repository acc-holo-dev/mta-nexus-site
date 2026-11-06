import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseControlRepositoryDbMock } = await import(
    "./helpers/resource-release-control-repository-harness"
  );
  return createResourceReleaseControlRepositoryDbMock();
});

import { ResourceLibrarySelectionsRepository } from "../packages/db/src/repositories/resource-library-selections";
import {
  clockRows,
  fixed,
  input,
  liveBuyerSession,
  now,
  ownedRows,
  resetResourceReleaseControlRepositoryState,
  stamp,
  resourceReleaseControlRepositoryState as state,
} from "./helpers/resource-release-control-repository-harness";

const library = new ResourceLibrarySelectionsRepository();

beforeEach(() => {
  resetResourceReleaseControlRepositoryState();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it("rechecks expiry after waiting on a build lock", async () => {
  state.results = [...ownedRows("published", "2026-10-10T12:00:00.001Z"), [], [["bld_a"]]];
  state.results.push(liveBuyerSession, [
    { observedAt: "2026-10-10T12:00:00.002Z", sessionCurrent: true },
  ]);
  // Application time remains behind the database clock after a blocking lock.
  await expect(library.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("fails closed when the database clock cannot be read", async () => {
  state.results = [...ownedRows(), [], [["bld_a"]], liveBuyerSession, [{ observedAt: "invalid" }]];
  await expect(library.command(input)).rejects.toMatchObject({
    code: "LIBRARY_RELEASE_TIME_UNKNOWN",
  });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("rejects malformed repository commands before taking locks", async () => {
  await expect(
    library.command({ ...input, command: { ...fixed, expectedRevision: 1.5 } }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
it("does not overwrite an unexpected insert race or write its audit", async () => {
  state.results = [...ownedRows(), [], [["bld_a"]], liveBuyerSession, clockRows, []];
  await expect(library.command(input)).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
  expect(state.queries.at(-1)?.sql).toContain("where false");
  expect(state.queries.some((q) => q.sql.includes('insert into "audit_events"'))).toBe(false);
});
it("guards an existing revision and advances a future timestamp monotonically", async () => {
  state.results = [
    ...ownedRows(),
    [[3, "latest", null, "2026-10-11T12:00:00.000Z"]],
    [["bld_a"]],
    liveBuyerSession,
    clockRows,
    [[4, "fixed", "bld_a", "2026-10-11T12:00:00.001Z"]],
    [],
    liveBuyerSession,
  ];
  await library.command({ ...input, command: { ...fixed, expectedRevision: 3 } });
  const query = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_library_selections"'),
  );
  expect(query?.sql).toContain('where "resource_library_selections"."revision" =');
  expect(query?.params).toContain("2026-10-11T12:00:00.001Z");
  expect(query?.params.at(-1)).toBe(3);
});

it.each([
  { sha256Hash: "b".repeat(64), fileSizeBytes: 100 },
  { sha256Hash: "a".repeat(64), fileSizeBytes: 101 },
])("rejects a reviewed archive identity that changed %j", async (reviewedArtifact) => {
  state.results = [...ownedRows(), [], [["bld_a", "a".repeat(64), 100]]];
  await expect(
    library.command({ ...input, command: { ...fixed, reviewedArtifact } }),
  ).rejects.toMatchObject({ code: "LIBRARY_RELEASE_REVIEW_CHANGED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  expect(state.queries.at(-1)?.sql).toContain("for share");
});
it("saves and replays an exact reviewed archive without duplicating audit", async () => {
  const reviewedArtifact = { sha256Hash: "a".repeat(64), fileSizeBytes: 100 };
  state.results = [
    ...ownedRows(),
    [],
    [["bld_a", reviewedArtifact.sha256Hash, 100]],
    liveBuyerSession,
    clockRows,
    [[1, "fixed", "bld_a", stamp]],
    [],
    liveBuyerSession,
  ];
  const first = await library.command({ ...input, command: { ...fixed, reviewedArtifact } });
  expect(first.selection).toMatchObject({ mode: "fixed", buildId: "bld_a", revision: 1 });
  state.queries = [];
  state.results = [
    ...ownedRows(),
    [[1, "fixed", "bld_a", stamp]],
    [["bld_a", reviewedArtifact.sha256Hash, 100]],
    liveBuyerSession,
    clockRows,
  ];
  expect(await library.command({ ...input, command: { ...fixed, reviewedArtifact } })).toEqual(
    first,
  );
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("requires the initiating raw session after all authority locks and before writes", async () => {
  state.results = [
    ...ownedRows(),
    [],
    [["bld_a"]],
    liveBuyerSession,
    clockRows,
    [[1, "fixed", "bld_a", stamp]],
    [],
    liveBuyerSession,
  ];
  await library.command(input);
  const sessionIndex = state.queries.findIndex(
    (q) => q.sql.includes('from "sessions"') && q.sql.includes("for update"),
  );
  expect(sessionIndex).toBeGreaterThan(
    state.queries.findIndex((q) => q.sql.includes('from "builds"')),
  );
  expect(state.queries[sessionIndex].params).toContain(
    createHash("sha256").update(input.currentToken).digest("hex"),
  );
  expect(state.queries[sessionIndex].params).not.toContain(input.currentToken);
  expect(
    state.queries
      .slice(sessionIndex + 1, -1)
      .map((q) => q.sql)
      .join("\n"),
  ).not.toMatch(/for (?:share|update|no key update)/u);
  expect(state.queries[sessionIndex + 1].sql).toContain("clock_timestamp()");
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
});
it("rejects missing sessions before locks and stale database session evidence before exact replay", async () => {
  await expect(library.command({ ...input, currentToken: "" })).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  expect(state.queries).toHaveLength(0);
  state.results = [
    ...ownedRows(),
    [[1, "fixed", "bld_a", stamp]],
    [["bld_a"]],
    liveBuyerSession,
    [{ observedAt: stamp, sessionCurrent: false }],
  ];
  await expect(library.command(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
