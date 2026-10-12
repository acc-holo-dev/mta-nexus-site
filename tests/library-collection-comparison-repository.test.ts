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
import { readLibraryCollectionComparison } from "../packages/db/src/repositories/library-collection-comparison";
const date = "2026-10-12T00:00:00.000Z",
  query = { to: "lcol_b", page: 1, filter: "all" as const, q: "", transfer: "copy" as const };
const ownedRows = () => [
  ["lcol_a", "Source & name", "archived", 4, 2],
  ["lcol_b", "Destination", "active", 2, 2],
];
const summary = { all: 3, sourceOnly: 1, destinationOnly: 1, common: 1, unavailable: 2, total: 3 };
const prefix = () => [[["usr_a"]], ownedRows(), [{ observedAt: date }]] as unknown[][];
const sqlText = () => state.queries.map((q) => q.sql).join("\n");
beforeEach(() => {
  state.rows = [];
  state.queries = [];
  state.options = [];
});
it("compares bounded own reference sets in one database-time snapshot and strips hidden metadata", async () => {
  state.rows = [
    ...prefix(),
    [summary],
    [
      {
        productId: "prd_a",
        title: "Accessible",
        available: true,
        inSource: true,
        inDestination: false,
        storageKey: "PRIVATE",
      },
      {
        productId: "prd_common",
        title: "PRIVATE",
        available: false,
        inSource: true,
        inDestination: true,
      },
      {
        productId: "prd_destination",
        title: null,
        available: false,
        inSource: false,
        inDestination: true,
      },
    ],
  ];
  const report = await readLibraryCollectionComparison("usr_a", "lcol_a", query);
  expect(report.source).toEqual({
    id: "lcol_a",
    name: "Source & name",
    status: "archived",
    revision: 4,
    itemCount: 2,
  });
  expect(report.targets).toHaveLength(1);
  expect(report.comparison).toMatchObject({
    destination: { id: "lcol_b", revision: 2 },
    counts: { all: 3, common: 1 },
    pageSize: 20,
    total: 3,
    items: [
      {
        productId: "prd_a",
        title: "Accessible",
        available: true,
        inSource: true,
        inDestination: false,
      },
      {
        productId: "prd_common",
        title: null,
        available: false,
        inSource: true,
        inDestination: true,
      },
      {
        productId: "prd_destination",
        title: null,
        available: false,
        inSource: false,
        inDestination: true,
      },
    ],
  });
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(state.queries[1]?.params).toContain("usr_a");
  expect(state.queries[1]?.params.at(-1)).toBe(31);
  expect(state.queries[4]?.params).toContain(20);
  expect(sqlText()).toContain("bool_or");
  expect(sqlText()).toContain("transaction_timestamp()");
  expect(state.queries[4]?.params).toContain("clean");
  expect(sqlText()).not.toMatch(/insert into|delete from|update |for update/iu);
});
it("chooses from own archived and active targets without accessing product metadata", async () => {
  state.rows = prefix();
  const report = await readLibraryCollectionComparison("usr_a", "lcol_a", {
    page: 1,
    filter: "all",
    q: "",
    transfer: "move",
  });
  expect(report.comparison).toBeNull();
  expect(report.targets[0]?.id).toBe("lcol_b");
  expect(state.queries).toHaveLength(3);
  expect(sqlText()).not.toContain('"products"');
});
it("rejects absent users and foreign source/destination before resource inspection", async () => {
  state.rows = [[]];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_a", query)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries).toHaveLength(1);
  state.queries = [];
  state.rows = [[["usr_a"]], ownedRows()];
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_foreign", query),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
  state.queries = [];
  state.rows = [[["usr_a"]], ownedRows()];
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, to: "lcol_foreign" }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(2);
});
it.each(["source-only", "destination-only", "common", "unavailable"] as const)(
  "applies safe %s predicates and literal accessible-name search",
  async (filter) => {
    state.rows = [...prefix(), [{ ...summary, total: 0 }], []];
    await readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, filter, q: "100%_\\" });
    expect(sqlText()).toContain("title ILIKE");
    expect(state.queries[3]?.params).toContain("%100\\%\\_\\\\%");
    expect(sqlText()).toContain(filter === "unavailable" ? "NOT available" : '"inSource"');
  },
);
it("rejects self-comparison, malformed direct arguments and impossible bounds", async () => {
  await expect(
    readLibraryCollectionComparison("usr_a", "lcol_a", { ...query, to: "lcol_a" }),
  ).rejects.toMatchObject({ statusCode: 400 });
  await expect(readLibraryCollectionComparison("usr_a", "../private", query)).rejects.toMatchObject(
    { statusCode: 400 },
  );
  expect(state.queries).toHaveLength(0);
  state.rows = [
    [["usr_a"]],
    Array.from({ length: 31 }, (_, i) => [`lcol_${i}`, "Name", "active", 1, 0]),
  ];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_0", query)).rejects.toMatchObject({
    code: "COLLECTION_ITEM_LIMIT",
  });
  state.rows = [...prefix(), [{ ...summary, all: 401 }]];
  await expect(readLibraryCollectionComparison("usr_a", "lcol_a", query)).rejects.toMatchObject({
    code: "COLLECTION_ITEM_LIMIT",
  });
});
