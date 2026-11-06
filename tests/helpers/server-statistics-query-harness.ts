import { afterEach, beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for server-statistics-query suites. */
export const serverStatisticsQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerStatisticsQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverStatisticsQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetServerStatisticsQueryState() {
  serverStatisticsQueryState.queries = [];
  serverStatisticsQueryState.config = null;
  serverStatisticsQueryState.rows = [
    [["server", "Server", "server", "public", "active", 0]],
    [
      ["current", "8000", "7900", "2026-10-10T01:00:00Z", "2026-10-10T23:59:00Z", "100", "32.5"],
      ["previous", "20", "19", "2026-10-09T01:00:00Z", "2026-10-09T23:59:00Z", "30", "12.5"],
    ],
    [
      [
        "2026-10-10T23:00:00Z",
        "1",
        "1",
        "2026-10-10T23:59:00Z",
        "2026-10-10T23:59:00Z",
        "2",
        "2",
        "64",
      ],
    ],
    [["obs_1", "2026-10-10T23:59:00Z", 2, 64, "mode", "map", "1.6", false, true]],
  ];
}

export const serverStatisticsQueryEnd = new Date("2026-10-11T00:00:00.000Z");

export function installServerStatisticsQueryHooks() {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(serverStatisticsQueryEnd);
    resetServerStatisticsQueryState();
  });
  afterEach(() => vi.useRealTimers());
}
