import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for resource-release-watches-repository suites. */
export const resourceReleaseWatchesRepositoryState = {
  sessionLive: true,
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  clock: "2026-10-12T00:00:00.000Z",
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceReleaseWatchesRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceReleaseWatchesRepositoryState;
  const raw = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"'))
      return { rows: state.sessionLive ? [["ses_a", "2099-01-01T00:00:00.000Z"]] : [] };
    if (sql.startsWith("set local")) return { rows: [] };
    if (sql.includes('AS "observedAt"')) return { rows: [{ observedAt: state.clock }] };
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
}

export function resetResourceReleaseWatchesRepositoryState() {
  resourceReleaseWatchesRepositoryState.sessionLive = true;
  resourceReleaseWatchesRepositoryState.queries = [];
  resourceReleaseWatchesRepositoryState.rows = [];
  resourceReleaseWatchesRepositoryState.clock = "2026-10-12T00:00:00.000Z";
}

export function installResourceReleaseWatchesRepositoryHooks() {
  beforeEach(() => {
    resetResourceReleaseWatchesRepositoryState();
  });
}
