import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createCollectionReleaseWatchesRepositoryDbMock } = await import(
    "./helpers/collection-release-watches-repository-harness"
  );
  return createCollectionReleaseWatchesRepositoryDbMock();
});

import { enableCollectionReleaseWatches as enable } from "../packages/db/src/repositories/collection-release-watches";
import {
  collectionReleaseWatchesRepositoryInput as input,
  collectionReleaseWatchesRepositoryOwned as owned,
  collectionReleaseWatchesRepositoryOutput as output,
  collectionReleaseWatchesRepositoryReady as ready,
  collectionReleaseWatchesRepositoryStamp as stamp,
  collectionReleaseWatchesRepositoryState as state,
  collectionReleaseWatchesRepositorySuccess as success,
  installCollectionReleaseWatchesRepositoryHooks,
} from "./helpers/collection-release-watches-repository-harness";

installCollectionReleaseWatchesRepositoryHooks();

it("holds collection membership, rights, safe builds and current watch revisions before one baseline upsert and audit", async () => {
  success();
  const result = await enable(input);
  expect(result.changedCount).toBe(2);
  expect(result.items.map((row) => row.productId)).toEqual(["prd_a", "prd_b"]);
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("library_collection_items");
  expect(text).toContain("for share");
  expect(text).toContain("for no key update");
  expect(text).toContain("clock_timestamp()");
  expect(state.queries.find((query) => query.sql.includes('from "entitlements"'))?.sql).toContain(
    "clock_timestamp()",
  );
  expect(text).toContain("max(");
  expect(text).toContain("resource_release_events");
  expect(text).toContain("excluded.revision-1");
  expect(text).toContain('"resource_release_watches"."enabled"=false');
  expect(state.queries.at(-1)?.params).toContain("library.collection_release_watches_enabled");
  expect(JSON.stringify(result)).not.toContain("lastSequence");
});
it.each([
  ["archived", 3],
  ["active", 4],
])(
  "rejects changed or archived collection %s/%s before resource enrollment",
  async (status, revision) => {
    state.rows = owned(status, revision);
    await expect(enable(input)).rejects.toMatchObject({
      code: "RELEASE_WATCH_COLLECTION_CONFLICT",
    });
    expect(state.queries.some((q) => q.sql.includes("INSERT INTO"))).toBe(false);
  },
);
it("rejects a resource removed from the reviewed membership", async () => {
  state.rows = [...owned(), [["prd_a"]]];
  await expect(enable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" });
});
it("enforces the account-wide quota before enrollment", async () => {
  state.rows = [...ready(), [[99]]];
  await expect(enable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_LIMIT" });
  expect(state.queries.some((q) => q.sql.includes("INSERT INTO"))).toBe(false);
});
it("rejects access expiring while a later lock was being awaited", async () => {
  const rows = ready();
  rows[8] = [["ent_a", "2026-10-12T00:00:00.001Z"]];
  state.rows = [...rows, [[5]], [{ observedAt: "2026-10-12T00:00:00.002Z" }]];
  await expect(enable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
  expect(state.queries.some((q) => q.sql.includes("INSERT INTO"))).toBe(false);
});
it("does not reapply a complete enabled successor state or duplicate its audit", async () => {
  state.rows = [
    ...ready([
      ["prd_a", true, 1, stamp],
      ["prd_b", true, 3, stamp],
    ]),
    [{ observedAt: stamp }],
  ];
  expect(await enable(input)).toMatchObject({ changedCount: 0 });
  expect(
    state.queries.some((q) => q.sql.includes("INSERT INTO") || q.sql.startsWith("insert")),
  ).toBe(false);
});
it("rejects mixed previous and successor states without partial enrollment", async () => {
  state.rows = ready([
    ["prd_a", true, 1, stamp],
    ["prd_b", false, 2, stamp],
  ]);
  await expect(enable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
it("propagates a mandatory audit failure and rejects a partial guarded upsert", async () => {
  success();
  state.failAudit = true;
  await expect(enable(input)).rejects.toMatchObject({ cause: { message: "audit failed" } });
  state.failAudit = false;
  state.rows = [...ready(), [[5]], [{ observedAt: stamp }], [output[0]]];
  await expect(enable(input)).rejects.toMatchObject({ code: "RELEASE_WATCH_BATCH_CONFLICT" });
});
it("checks the initiating session after every authority lock before reading the enrollment clock", async () => {
  success();
  await enable(input);
  const sessionIndex = state.queries.findIndex((q) => q.sql.includes('from "sessions"'));
  expect(sessionIndex).toBeGreaterThan(
    state.queries.findIndex((q) => q.sql.includes("for no key update")),
  );
  expect(state.queries[sessionIndex + 1]?.sql).toContain('AS "observedAt"');
  expect(
    state.queries
      .slice(sessionIndex + 1)
      .some((q) => /for (share|update|no key update)/u.test(q.sql)),
  ).toBe(false);
  state.queries = [];
  state.sessionLive = false;
  state.rows = [
    ...ready([
      ["prd_a", true, 1, stamp],
      ["prd_b", true, 3, stamp],
    ]),
  ];
  await expect(enable(input)).rejects.toMatchObject({ statusCode: 401 });
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
});
