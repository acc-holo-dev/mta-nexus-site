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

it("locks live buyer rights and a cleared build before saving a preference with audit", async () => {
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
  expect(await library.command(input)).toMatchObject({
    productId: "prd_a",
    selection: { revision: 1, mode: "fixed", buildId: "bld_a" },
  });
  const sql = state.queries.map((q) => q.sql).join("\n");
  expect(sql).toContain("pg_advisory_xact_lock");
  expect(sql).toContain('"entitlements"."subject_id" =');
  expect(sql).toContain("for share");
  const buildQuery = state.queries.find((q) => q.sql.includes('from "builds"'));
  expect(buildQuery?.params).toEqual(
    expect.arrayContaining(["prd_a", "bld_a", "published", "clean"]),
  );
  expect(buildQuery?.sql).toContain('"builds"."scanner" is not null');
  expect(buildQuery?.sql).toContain('"builds"."scanned_at" is not null');
  expect(sql).toContain('insert into "resource_library_selections"');
  expect(sql).toContain('insert into "audit_events"');
  expect(state.queries.find((q) => q.sql.includes('insert into "audit_events"'))?.params).toContain(
    "library.release_selected",
  );
  expect(sql).not.toMatch(
    /(?:insert into|update) "(?:entitlements|licenses|payments|orders|ledger_entries)"/u,
  );
});
it("does not turn publisher or administrator access into a buyer library right", async () => {
  state.results = [[], [["prd_a", "Title", "slug", "published"]], [["usr_a"]], [], []];
  await expect(library.command(input)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries.map((q) => q.sql).join("\n")).not.toContain("insert into");
  expect(state.queries.some((q) => q.sql.includes('"licenses"."status"'))).toBe(true);
});
it.each(["suspended", "archived", "draft"])(
  "cannot pin a version on a %s resource",
  async (status) => {
    state.results = [...ownedRows(status), []];
    await expect(library.command(input)).rejects.toMatchObject({
      code: "LIBRARY_RELEASE_UNAVAILABLE",
    });
    expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  },
);
it("rejects withdrawn or foreign fixed builds without substituting the latest", async () => {
  state.results = [...ownedRows(), [], []];
  await expect(library.command(input)).rejects.toMatchObject({
    code: "LIBRARY_RELEASE_UNAVAILABLE",
  });
  expect(state.queries.at(-1)?.params).toContain("bld_a");
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("a stale preference cannot overwrite another device's selection", async () => {
  state.results = [...ownedRows(), [[2, "fixed", "bld_other", stamp]], [["bld_a"]]];
  await expect(library.command(input)).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("an exact command replay keeps its revision and creates no duplicate audit", async () => {
  state.results = [
    ...ownedRows(),
    [[1, "fixed", "bld_a", stamp]],
    [["bld_a"]],
    liveBuyerSession,
    clockRows,
  ];
  expect(await library.command(input)).toMatchObject({ selection: { revision: 1 } });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});
it("can clear a withdrawn preference while a resource is suspended, without granting files", async () => {
  state.results = [
    ...ownedRows("suspended"),
    [[3, "fixed", "withdrawn", stamp]],
    liveBuyerSession,
    clockRows,
    [[4, "latest", null, "2026-10-10T12:00:00.001Z"]],
    [],
    liveBuyerSession,
  ];
  expect(
    await library.command({ ...input, command: { mode: "latest", expectedRevision: 3 } }),
  ).toMatchObject({ selection: { mode: "latest", buildId: null, revision: 4 } });
  expect(state.queries.some((q) => q.sql.includes('from "builds"'))).toBe(false);
});
