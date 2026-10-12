import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failed");
    return { rows: state.rows.shift() ?? [] };
  });
  const db: typeof raw = new Proxy(raw, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof raw) => unknown) => callback(db);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db };
});
import {
  enableCollectionReleaseWatches as enable,
  readCollectionReleaseWatches as page,
} from "../packages/db/src/repositories/collection-release-watches";
const stamp = "2026-10-12T00:00:00.000Z";
const input = {
  userId: "usr_a",
  collectionId: "lcol_a",
  auditId: "aud_a",
  command: {
    expectedCollectionRevision: 3,
    items: [
      { productId: "prd_a", expectedRevision: 0 },
      { productId: "prd_b", expectedRevision: 2 },
    ],
  },
};
const owned = (status = "active", revision = 3) => [
  [],
  [],
  [],
  [],
  [["usr_a"]],
  [["lcol_a", "Core", status, revision]],
];
const ready = (previous: unknown[][] = [["prd_b", false, 2, stamp]]) => [
  ...owned(),
  [["prd_a"], ["prd_b"]],
  [
    ["prd_a", "published"],
    ["prd_b", "published"],
  ],
  [["ent_a", null]],
  [["bld_a"]],
  [["ent_b", null]],
  [["bld_b"]],
  previous,
];
const output = [
  { productId: "prd_b", enabled: true, revision: 3, updatedAt: stamp },
  { productId: "prd_a", enabled: true, revision: 1, updatedAt: stamp },
];
function success() {
  state.rows = [...ready(), [[5]], [{ observedAt: stamp }], output, []];
}
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.failAudit = false;
});
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
it("reads only an owner's collection in a masked, bounded database-time snapshot", async () => {
  state.rows = [
    [["usr_a"]],
    [["lcol_a", "Core", "archived", 3]],
    [{ all: 1, enabled: 0, disabled: 1, unavailable: 1, activeWatchCount: 4 }],
    [
      {
        productId: "prd_a",
        enabled: false,
        revision: 0,
        updatedAt: null,
        available: false,
        title: "PRIVATE-TITLE",
        lastSequence: "PRIVATE-CURSOR",
      },
    ],
  ];
  const result = await page("usr_a", "lcol_a", 1, "all", "Core");
  expect(result).toMatchObject({
    collection: { status: "archived" },
    activeWatchCount: 4,
    items: [{ title: null, updatedAt: null }],
  });
  expect(JSON.stringify(result)).not.toContain("PRIVATE");
  const text = state.queries.map((q) => q.sql).join("\n");
  expect(text).toContain("transaction_timestamp()");
  expect(text).toContain("WHERE available AND title ILIKE");
  expect(text).toContain("watch.user_id=");
  expect(text).not.toMatch(/for share|last_sequence|storage_key/u);
});
it("rejects foreign collections and malformed direct commands before granting any watch", async () => {
  state.rows = [[["usr_a"]], []];
  await expect(page("usr_a", "lcol_other")).rejects.toMatchObject({ statusCode: 404 });
  state.queries = [];
  await expect(
    enable({ ...input, command: { ...input.command, expectedCollectionRevision: 0 } }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});
