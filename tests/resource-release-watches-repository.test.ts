import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchesRepositoryDbMock } = await import(
    "./helpers/resource-release-watches-repository-harness"
  );
  return createResourceReleaseWatchesRepositoryDbMock();
});

import { resourceReleaseWatchesRepository as repo } from "../packages/db/src/repositories/resource-release-watches";
import {
  installResourceReleaseWatchesRepositoryHooks,
  resourceReleaseWatchesRepositoryState as state,
} from "./helpers/resource-release-watches-repository-harness";

installResourceReleaseWatchesRepositoryHooks();

it("enrolls at the latest committed release with held live grants, serialized quota and atomic audit", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[2]],
    [["9007199254740993"]],
    [["prd_a", true, 1, "2026-10-11T00:00:00Z"]],
    [],
  ];
  const result = await repo.command({
    userId: "usr_a",
    currentToken: "tok_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  });
  expect(result).toMatchObject({ productId: "prd_a", enabled: true, revision: 1 });
  expect(result).not.toHaveProperty("lastSequence");
  expect(state.queries[2].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[5].sql).toContain("for share");
  const insert = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(insert?.params).toContain(9007199254740993n);
  expect(state.queries.at(-1)?.params).toContain("library.release_watch_changed");
});

it("allows a user to stop their watch after access is revoked, and handles a replay without writes", async () => {
  state.rows = [
    [],
    [["prd_a", "suspended"]],
    [["usr_a"]],
    [["prd_a", true, 1, "2026-10-11T00:00:00Z", "4"]],
    [["5"]],
    [["prd_a", false, 2, "2026-10-11T00:01:00Z"]],
    [],
  ];
  const input = {
    userId: "usr_a",
    currentToken: "tok_a",
    productId: "prd_a",
    command: { enabled: false, expectedRevision: 1 },
    auditId: "aud_a",
  };
  expect(await repo.command(input)).toMatchObject({ enabled: false, revision: 2 });
  expect(state.queries.some((q) => q.sql.includes('from "entitlements"'))).toBe(false);
  state.queries = [];
  state.rows = [
    [],
    [["prd_a", "suspended"]],
    [["usr_a"]],
    [["prd_a", false, 2, "2026-10-11T00:01:00Z", "5"]],
  ];
  expect(await repo.command(input)).toMatchObject({ enabled: false, revision: 2 });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("refuses enrollment without access, missing publication and quota overflow", async () => {
  const input = {
    userId: "usr_a",
    currentToken: "tok_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  };
  state.rows = [[], [["prd_a", "published"]], [["usr_a"]], [], []];
  await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[100]],
  ];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_LIMIT" });
  state.rows = [[], [["prd_a", "draft"]], [["usr_a"]], [["ent_a", null]]];
  await expect(repo.command(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
});

it("stale revisions cannot overwrite another user's later preference", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [["prd_a", false, 3, "2026-10-11T00:00:00Z", "4"]],
  ];
  await expect(
    repo.command({
      userId: "usr_a",
      currentToken: "tok_a",
      productId: "prd_a",
      command: { enabled: true, expectedRevision: 1 },
      auditId: "aud_a",
    }),
  ).rejects.toMatchObject({ code: "RELEASE_WATCH_CONFLICT" });
  expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
});

it("rejects malformed direct commands before acquiring any database lock", async () => {
  for (const command of [
    { enabled: "yes", expectedRevision: 0 },
    { enabled: true, expectedRevision: -1 },
    { enabled: true, expectedRevision: 2147483647 },
    { enabled: true, expectedRevision: 0, lastSequence: "8" },
  ]) {
    await expect(
      repo.command({
        userId: "usr_a",
        currentToken: "tok_a",
        productId: "prd_a",
        command: command as never,
        auditId: "aud_a",
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_INVALID" });
  }
  expect(state.queries).toHaveLength(0);
});

it("checks a finite grant at database time after the final locks, including a replay", async () => {
  const input = {
    userId: "usr_a",
    currentToken: "tok_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 0 },
    auditId: "aud_a",
  };
  for (const replay of [false, true]) {
    state.queries = [];
    state.rows = [
      [],
      [["prd_a", "published"]],
      [["usr_a"]],
      [["ent_a", "2026-10-12T00:00:00Z"]],
      [["bld_a"]],
      replay ? [["prd_a", true, 1, "2026-10-11T00:00:00Z", "4"]] : [],
      ...(!replay ? [[[2]], [["5"]]] : []),
    ];
    await expect(repo.command(input)).rejects.toMatchObject({ statusCode: 404 });
    expect(state.queries.some((q) => q.sql.startsWith("insert into"))).toBe(false);
    expect(state.queries.find((q) => q.sql.includes('from "entitlements"'))?.sql).toContain(
      "clock_timestamp()",
    );
    expect(state.queries.at(-1)?.sql).toContain("clock_timestamp()");
  }
});

it("guards an existing upsert and retains monotonic progress and update time", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [["prd_a", false, 2, "2026-10-12T00:01:00Z", "8"]],
    [[1]],
    [["5"]],
    [["prd_a", true, 3, "2026-10-12T00:01:00.001Z"]],
    [],
  ];
  await repo.command({
    userId: "usr_a",
    currentToken: "tok_a",
    productId: "prd_a",
    command: { enabled: true, expectedRevision: 2 },
    auditId: "aud_a",
  });
  const update = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(update?.sql).toContain("greatest");
  expect(update?.sql).toContain("interval '1 millisecond'");
  expect(update?.sql).toContain('where ("resource_release_watches"."revision" =');
  expect(update?.params).toContain(8n);
});

it("never audits an unexpected insertion conflict", async () => {
  state.rows = [
    [],
    [["prd_a", "published"]],
    [["usr_a"]],
    [["ent_a", null]],
    [["bld_a"]],
    [],
    [[1]],
    [["5"]],
    [],
  ];
  await expect(
    repo.command({
      userId: "usr_a",
      currentToken: "tok_a",
      productId: "prd_a",
      command: { enabled: true, expectedRevision: 0 },
      auditId: "aud_a",
    }),
  ).rejects.toMatchObject({ code: "RELEASE_WATCH_CONFLICT" });
  const update = state.queries.find((q) =>
    q.sql.startsWith('insert into "resource_release_watches"'),
  );
  expect(update?.sql).toContain("where false");
  expect(state.queries.some((q) => q.sql.startsWith('insert into "audit_events"'))).toBe(false);
});

it("rejects a revoked initiator after the watch lock, including an idempotent stop", async () => {
  state.sessionLive = false;
  for (const replay of [false, true]) {
    state.queries = [];
    state.rows = [
      [],
      [["prd_a", "suspended"]],
      [["usr_a"]],
      [["prd_a", !replay, replay ? 2 : 1, "2026-10-11T00:00:00Z", "4"]],
    ];
    await expect(
      repo.command({
        userId: "usr_a",
        currentToken: "tok_a",
        productId: "prd_a",
        command: { enabled: false, expectedRevision: 1 },
        auditId: "aud_a",
      }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(state.queries.at(-2)?.sql).toContain("for no key update");
    expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
    expect(state.queries.some((q) => q.sql.startsWith("insert"))).toBe(false);
  }
});
