import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for library-collection-comparison-repository suites. */
export const libraryCollectionComparisonRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryCollectionComparisonRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = libraryCollectionComparisonRepositoryState;
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

function resetLibraryCollectionComparisonRepositoryState() {
  libraryCollectionComparisonRepositoryState.rows = [];
  libraryCollectionComparisonRepositoryState.queries = [];
  libraryCollectionComparisonRepositoryState.options = [];
}

export function installLibraryCollectionComparisonRepositoryHooks() {
  beforeEach(() => {
    resetLibraryCollectionComparisonRepositoryState();
  });
}

export const libraryCollectionComparisonRepositoryDate = "2026-10-12T00:00:00.000Z";
export const libraryCollectionComparisonRepositoryQuery = {
  to: "lcol_b",
  page: 1,
  filter: "all" as const,
  q: "",
  transfer: "copy" as const,
};

export function libraryCollectionComparisonRepositoryOwnedRows() {
  return [
    ["lcol_a", "Source & name", "archived", 4, 2],
    ["lcol_b", "Destination", "active", 2, 2],
  ];
}

export const libraryCollectionComparisonRepositorySummary = {
  all: 3,
  sourceOnly: 1,
  destinationOnly: 1,
  common: 1,
  unavailable: 2,
  total: 3,
};

export function libraryCollectionComparisonRepositoryPrefix() {
  return [
    [["usr_a"]],
    libraryCollectionComparisonRepositoryOwnedRows(),
    [{ observedAt: libraryCollectionComparisonRepositoryDate }],
  ] as unknown[][];
}

export function libraryCollectionComparisonRepositorySqlText() {
  return libraryCollectionComparisonRepositoryState.queries.map((q) => q.sql).join("\n");
}
