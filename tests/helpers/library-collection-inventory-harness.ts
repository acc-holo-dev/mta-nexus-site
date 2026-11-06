import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for library-collection-inventory suites. */
export const libraryCollectionInventoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryCollectionInventoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    libraryCollectionInventoryState.queries.push({ sql, params });
    return { rows: libraryCollectionInventoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            libraryCollectionInventoryState.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetLibraryCollectionInventoryState() {
  libraryCollectionInventoryState.rows = [];
  libraryCollectionInventoryState.queries = [];
  libraryCollectionInventoryState.options = [];
}

export function installLibraryCollectionInventoryHooks() {
  beforeEach(() => {
    resetLibraryCollectionInventoryState();
  });
}

export const libraryCollectionInventoryDate = "2026-10-13T00:00:00.000Z";
export const libraryCollectionInventoryQuery = {
  page: 1,
  status: "all" as const,
  filter: "all" as const,
  q: "",
};

export function libraryCollectionInventoryOwn() {
  return [
    ["lcol_a", "Active & name", "active", 4, 2],
    ["lcol_b", "Archived", "archived", 7, 1],
  ];
}

export const libraryCollectionInventorySummary = {
  resources: 2,
  references: 3,
  available: 1,
  unavailable: 1,
  shared: 1,
  total: 2,
  releaseLatest: 1,
  releasePinned: 0,
  releaseUpdates: 0,
  selectionUnavailable: 0,
  attention: 1,
};

export function libraryCollectionInventoryPrefix() {
  return [
    [["usr_a"]],
    libraryCollectionInventoryOwn(),
    [{ observedAt: libraryCollectionInventoryDate }],
  ] as unknown[][];
}

export function libraryCollectionInventoryRows() {
  return [
    {
      productId: "prd_a",
      title: "Accessible",
      available: true,
      membershipCount: 2,
      mode: "latest",
      revision: 0,
      canReviewRequirements: true,
      state: "latest",
      latestBuildId: "bld_latest",
      latestVersion: "2.0.0",
      selectedBuildId: null,
      selectedVersion: null,
      storageKey: "PRIVATE",
    },
    { productId: "prd_orphan", title: "PRIVATE", available: false, membershipCount: 1 },
  ];
}

export function libraryCollectionInventoryMemberships() {
  return [
    ["prd_a", "lcol_a", libraryCollectionInventoryDate],
    ["prd_a", "lcol_b", libraryCollectionInventoryDate],
    ["prd_orphan", "lcol_a", libraryCollectionInventoryDate],
  ];
}

export function libraryCollectionInventoryText() {
  return libraryCollectionInventoryState.queries.map((q) => q.sql).join("\n");
}
