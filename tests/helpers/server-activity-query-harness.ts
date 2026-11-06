import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for server-activity-query suites. */
export const serverActivityQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  config: null as unknown,
  failure: null as Error | null,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerActivityQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverActivityQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failure) throw state.failure;
    return { rows: state.results.shift() ?? [] };
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

function resetServerActivityQueryState() {
  const state = serverActivityQueryState;
  state.queries = [];
  state.results = [[["server", "Server"]], [serverActivityQueryEvent()]];
  state.config = null;
  state.failure = null;
}

export function installServerActivityQueryHooks() {
  beforeEach(() => {
    resetServerActivityQueryState();
  });
}

export const serverActivityQueryActor = { id: "actor", role: "user" as const };

export function serverActivityQueryEvent(id = "aud_2") {
  return [
    id,
    "server.updated",
    "editor",
    "user",
    "editor",
    "Editor",
    ["name"],
    "2026-10-10T10:00:00Z",
  ];
}
