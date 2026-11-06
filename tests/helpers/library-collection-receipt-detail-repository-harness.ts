import { createHash } from "node:crypto";
import { beforeEach } from "vitest";
import { libraryCollectionCommandSchema } from "../../packages/validation/src/library-collections";

/** Shared pg-proxy query capture for library-collection-receipt-detail-repository suites. */
export const libraryCollectionReceiptDetailRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryCollectionReceiptDetailRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = libraryCollectionReceiptDetailRepositoryState;
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
}

export function resetLibraryCollectionReceiptDetailRepositoryState() {
  const state = libraryCollectionReceiptDetailRepositoryState;
  state.rows = [];
  state.queries = [];
  state.options = [];
}

export function installLibraryCollectionReceiptDetailRepositoryHooks() {
  beforeEach(() => {
    resetLibraryCollectionReceiptDetailRepositoryState();
  });
}

export const libraryCollectionReceiptDetailRepositoryDate = "2026-10-13T00:00:00.000Z";
export const libraryCollectionReceiptDetailRepositoryRequestId =
  "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export const libraryCollectionReceiptDetailRepositoryCommand = libraryCollectionCommandSchema.parse(
  {
    requestId: libraryCollectionReceiptDetailRepositoryRequestId,
    action: "reconcile-items",
    expectedRevision: 2,
    addProductIds: ["prd_added"],
    removeProductIds: ["prd_removed"],
  },
);

export const libraryCollectionReceiptDetailRepositorySnapshot = {
  id: "lcol_a",
  name: "Recorded & name",
  status: "active",
  revision: 3,
};

export function libraryCollectionReceiptDetailRepositoryRow(
  proof: unknown = libraryCollectionReceiptDetailRepositoryCommand,
  digest = createHash("sha256")
    .update(JSON.stringify(libraryCollectionReceiptDetailRepositoryCommand))
    .digest("hex"),
) {
  return [
    "lcr_a",
    libraryCollectionReceiptDetailRepositoryRequestId,
    "lcol_a",
    digest,
    proof,
    libraryCollectionReceiptDetailRepositorySnapshot,
    libraryCollectionReceiptDetailRepositoryDate,
  ];
}

export function libraryCollectionReceiptDetailRepositoryPrefix() {
  return [
    [["usr_a"]],
    [{ observedAt: libraryCollectionReceiptDetailRepositoryDate }],
  ] as unknown[][];
}

export function libraryCollectionReceiptDetailRepositoryText() {
  return libraryCollectionReceiptDetailRepositoryState.queries.map((q) => q.sql).join("\n");
}
