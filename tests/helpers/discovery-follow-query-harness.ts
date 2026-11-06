import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for discovery-follow-query suites. */
export const discoveryFollowQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createDiscoveryFollowQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = discoveryFollowQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetDiscoveryFollowQueryState() {
  discoveryFollowQueryState.queries = [];
  discoveryFollowQueryState.rows = [];
}

export function installDiscoveryFollowQueryHooks() {
  beforeEach(() => {
    resetDiscoveryFollowQueryState();
  });
}

export const discoveryFollowQueryStamp = "2026-10-10T12:00:00.123456Z";

export function discoveryFollowQueryFollowRow(id: string, title: string | null = "Team") {
  return [
    id,
    "organization",
    "org",
    true,
    discoveryFollowQueryStamp,
    discoveryFollowQueryStamp,
    title,
    title ? "team" : null,
    null,
    null,
    false,
  ];
}
