import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for discussion-watch-query suites. */
export const discussionWatchQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createDiscussionWatchQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = discussionWatchQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: sql.includes("pg_advisory_xact_lock") ? [] : (state.rows.shift() ?? []) };
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

export function resetDiscussionWatchQueryState() {
  discussionWatchQueryState.queries = [];
  discussionWatchQueryState.rows = [];
}

export function installDiscussionWatchQueryHooks() {
  beforeEach(() => {
    resetDiscussionWatchQueryState();
  });
}

export const discussionWatchQueryStamp = "2026-10-12T00:00:00.123456Z";
