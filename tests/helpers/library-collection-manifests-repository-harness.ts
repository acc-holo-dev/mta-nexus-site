import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for library-collection-manifests-repository suites. */
export const libraryCollectionManifestsRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryCollectionManifestsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    libraryCollectionManifestsRepositoryState.queries.push({ sql, params });
    return { rows: libraryCollectionManifestsRepositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            libraryCollectionManifestsRepositoryState.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetLibraryCollectionManifestsRepositoryState() {
  libraryCollectionManifestsRepositoryState.rows = [];
  libraryCollectionManifestsRepositoryState.queries = [];
  libraryCollectionManifestsRepositoryState.options = [];
}

export function installLibraryCollectionManifestsRepositoryHooks() {
  beforeEach(() => {
    resetLibraryCollectionManifestsRepositoryState();
  });
}

export const libraryCollectionManifestsRepositoryDate = "2026-10-12T00:00:00.000Z";

export const libraryCollectionManifestsRepositoryCollection = {
  id: "lcol_a",
  name: "Own & name",
  status: "active",
  revision: 7,
};

export function libraryCollectionManifestsRepositoryManifest() {
  return {
    schemaVersion: 1,
    generatedAt: "2000-01-01T00:00:00.000Z",
    collection: {
      ...libraryCollectionManifestsRepositoryCollection,
      id: "lcol_foreign",
      name: "PRIVATE IMPORT NAME",
    },
    productIds: ["prd_a", "prd_b", "prd_c", "prd_d"],
  };
}

export function libraryCollectionManifestsRepositoryPrefix(status = "active", revision = 7) {
  return [
    [["usr_a"]],
    [["lcol_a", "Own & name", status, revision]],
    [{ observedAt: libraryCollectionManifestsRepositoryDate }],
  ] as unknown[][];
}

export function libraryCollectionManifestsRepositoryText() {
  return libraryCollectionManifestsRepositoryState.queries.map((q) => q.sql).join("\n");
}
