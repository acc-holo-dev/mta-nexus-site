import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for resource-release-watch-history-repository suites. */
export const resourceReleaseWatchHistoryRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReleaseWatchHistoryRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceReleaseWatchHistoryRepositoryState;
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

function resetResourceReleaseWatchHistoryRepositoryState() {
  resourceReleaseWatchHistoryRepositoryState.rows = [];
  resourceReleaseWatchHistoryRepositoryState.queries = [];
  resourceReleaseWatchHistoryRepositoryState.options = [];
}

export function installResourceReleaseWatchHistoryRepositoryHooks() {
  beforeEach(() => {
    resetResourceReleaseWatchHistoryRepositoryState();
  });
}

export const resourceReleaseWatchHistoryRepositoryDate = "2026-10-12T00:00:00.000Z";
export const resourceReleaseWatchHistoryRepositoryQuery = {
  page: 1,
  days: 30 as const,
  source: "all" as const,
};

export function resourceReleaseWatchHistoryRepositoryEvent(extra: Record<string, unknown> = {}) {
  return {
    id: "aud_a",
    createdAt: resourceReleaseWatchHistoryRepositoryDate,
    action: "library.release_watch_changed",
    targetId: "prd_a",
    payload: { enabled: true, revision: 2, private: "SECRET-PAYLOAD" },
    private: "SECRET-AUDIT",
    ...extra,
  };
}
