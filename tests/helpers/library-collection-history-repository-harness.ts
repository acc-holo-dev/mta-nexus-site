import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for library-collection-history-repository suites. */
export const libraryCollectionHistoryRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryCollectionHistoryRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = libraryCollectionHistoryRepositoryState;
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

function resetLibraryCollectionHistoryRepositoryState() {
  libraryCollectionHistoryRepositoryState.rows = [];
  libraryCollectionHistoryRepositoryState.queries = [];
  libraryCollectionHistoryRepositoryState.options = [];
}

export function installLibraryCollectionHistoryRepositoryHooks() {
  beforeEach(() => {
    resetLibraryCollectionHistoryRepositoryState();
  });
}

export const libraryCollectionHistoryRepositoryDate = "2026-10-12T00:00:00.000Z";
export const libraryCollectionHistoryRepositoryRequestId =
  "67ca0352-de64-4af9-9e54-7d3c56fe8d89";
export const libraryCollectionHistoryRepositoryQuery = {
  page: 1,
  days: 30 as const,
  action: "all" as const,
};

export const libraryCollectionHistoryRepositoryCommand = {
  requestId: libraryCollectionHistoryRepositoryRequestId,
  action: "move-items",
  expectedRevision: 1,
  sourceCollectionId: "lcol_source",
  expectedSourceRevision: 4,
  productIds: ["prd_a", "prd_b"],
};

export const libraryCollectionHistoryRepositorySnapshot = {
  id: "lcol_dest",
  name: "Recorded & destination",
  status: "active",
  revision: 2,
};

export function libraryCollectionHistoryRepositoryRow(
  cmd: unknown = libraryCollectionHistoryRepositoryCommand,
  snap: unknown = libraryCollectionHistoryRepositorySnapshot,
) {
  return [
    "lcr_a",
    libraryCollectionHistoryRepositoryRequestId,
    "lcol_dest",
    cmd,
    snap,
    libraryCollectionHistoryRepositoryDate,
  ];
}

export function libraryCollectionHistoryRepositoryPrefix() {
  return [
    [["usr_a"]],
    [{ observedAt: libraryCollectionHistoryRepositoryDate }],
    [[1]],
  ] as unknown[][];
}

export function libraryCollectionHistoryRepositorySqlText() {
  return libraryCollectionHistoryRepositoryState.queries.map((q) => q.sql).join("\n");
}
