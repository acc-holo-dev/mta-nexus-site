import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { readLibraryCollectionHistory } from "../packages/db/src/repositories/library-collection-history";
const date = "2026-10-12T00:00:00.000Z",
  requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89",
  query = { page: 1, days: 30 as const, action: "all" as const };
const command = {
  requestId,
  action: "move-items",
  expectedRevision: 1,
  sourceCollectionId: "lcol_source",
  expectedSourceRevision: 4,
  productIds: ["prd_a", "prd_b"],
};
const snapshot = { id: "lcol_dest", name: "Recorded & destination", status: "active", revision: 2 };
const row = (cmd: unknown = command, snap: unknown = snapshot) => [
  "lcr_a",
  requestId,
  "lcol_dest",
  cmd,
  snap,
  date,
];
const prefix = () => [[["usr_a"]], [{ observedAt: date }], [[1]]] as unknown[][];
const sqlText = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("reads immutable moves with both current own collection states and masked resource labels in one snapshot", async () => {
  state.rows = [
    ...prefix(),
    [row()],
    [
      ["lcol_dest", "Current destination", "archived", 9],
      ["lcol_source", "Current source", "active", 7],
    ],
    [
      { productId: "prd_a", title: "Accessible", available: true, storageKey: "PRIVATE" },
      { productId: "prd_b", title: "PRIVATE", available: false },
    ],
  ];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]).toMatchObject({
    receipt: { collection: snapshot, sourceCollection: { id: "lcol_source", revision: 5 } },
    currentCollection: { name: "Current destination", revision: 9 },
    currentSource: { revision: 7 },
    resources: [
      { productId: "prd_a", currentTitle: "Accessible", currentAvailable: true },
      { productId: "prd_b", currentTitle: null, currentAvailable: false },
    ],
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(sqlText()).toContain("'product.download'");
  expect(sqlText()).toContain("'published'");
  expect(state.queries.at(-1)?.params).toContain("clean");
  expect(sqlText()).toContain("left(product.title,200)");
  expect(state.queries[2]?.params).toContain("usr_a");
  expect(state.queries[4]?.params).toContain("usr_a");
  expect(state.queries[3]?.params.at(-1)).toBe(20);
  expect(sqlText()).not.toMatch(/insert into|update |delete from|for update/iu);
});
it("matches whole operations by own actor, time window, exact resource membership and either participating collection", async () => {
  state.rows = [...prefix(), [row()], [], []];
  const report = await readLibraryCollectionHistory("usr_a", {
    page: 9999,
    days: 365,
    action: "move-items",
    collectionId: "lcol_source",
    productId: "prd_a",
  });
  expect(report.items[0]?.resources).toHaveLength(2);
  expect(report.page).toBe(1);
  expect(sqlText()).toContain("@>");
  expect(sqlText()).toContain("sourceCollectionId");
  expect(sqlText()).toContain("<= transaction_timestamp()");
  const params = state.queries[2]?.params ?? [];
  expect(params).toContain("[" + '"prd_a"' + "]");
  expect(params).toContain("usr_a");
  expect(params).toContain("lcol_source");
  expect(params).toContain(365);
});
it.each([
  { ...command, ownerId: "PRIVATE" },
  { ...command, action: "future-action" },
  { ...command, productIds: Array.from({ length: 21 }, (_, i) => `prd_${i}`) },
  { ...command, requestId: "7ca03522-de64-4af9-9e54-7d3c56fe8d89" },
])("projects invalid recorded proof neutrally without metadata lookups %o", async (cmd) => {
  state.rows = [...prefix(), [row(cmd)]];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]).toEqual({
    id: "lcr_a",
    createdAt: date,
    receipt: null,
    currentCollection: null,
    currentSource: null,
    resources: [],
  });
  expect(state.queries).toHaveLength(4);
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
});
it("refuses snapshot/route identity or successor mismatches instead of inventing proof", async () => {
  for (const snap of [
    { ...snapshot, id: "lcol_other" },
    { ...snapshot, revision: 99 },
    { ...snapshot, status: "archived" },
  ]) {
    state.rows = [...prefix(), [row(command, snap)]];
    expect((await readLibraryCollectionHistory("usr_a", query)).items[0]?.receipt).toBeNull();
  }
});
it("does not expand full-copy digests into invented resource history", async () => {
  const copy = {
    requestId,
    action: "duplicate",
    name: "Copy",
    sourceCollectionId: "lcol_source",
    expectedRevision: 4,
    expectedItemCount: 200,
    sourceDigest: "a".repeat(64),
  };
  state.rows = [...prefix(), [row(copy, { ...snapshot, name: "Copy", revision: 1 })], []];
  const report = await readLibraryCollectionHistory("usr_a", query);
  expect(report.items[0]?.receipt?.command).toEqual(copy);
  expect(report.items[0]?.resources).toEqual([]);
  expect(sqlText()).not.toContain("from refs");
});
it("requires a live user and rejects invalid direct selectors before any query", async () => {
  await expect(
    readLibraryCollectionHistory("usr_a", { ...query, page: 10000 }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
  state.rows = [[]];
  await expect(readLibraryCollectionHistory("usr_deleted", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
});
it("rejects an invalid database clock and handles empty history without extra lookups", async () => {
  state.rows = [[["usr_a"]], [{ observedAt: "invalid" }]];
  await expect(readLibraryCollectionHistory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  state.queries = [];
  state.rows = [[["usr_a"]], [{ observedAt: date }], [[0]], []];
  expect(await readLibraryCollectionHistory("usr_a", query)).toMatchObject({
    items: [],
    page: 1,
    totalPages: 1,
    total: 0,
  });
  expect(state.queries).toHaveLength(4);
});

it("matches either side of a reconciliation resource filter and returns the whole immutable operation", async () => {
  const proof = {
    requestId,
    action: "reconcile-items",
    expectedRevision: 1,
    addProductIds: ["prd_a"],
    removeProductIds: ["prd_b"],
  };
  state.rows = [...prefix(), [row(proof)], [], []];
  const report = await readLibraryCollectionHistory("usr_a", {
    ...query,
    action: "reconcile-items",
    productId: "prd_b",
  });
  expect(report.items[0]?.resources.map((resource) => resource.productId)).toEqual([
    "prd_a",
    "prd_b",
  ]);
  expect(sqlText()).toContain("removeProductIds");
  expect(sqlText()).toContain("addProductIds");
});
