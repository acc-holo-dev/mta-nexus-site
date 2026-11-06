import { createHash } from "node:crypto";
import { afterEach, beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for server-observation-browser-query suites. */
export const serverObservationBrowserQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerObservationBrowserQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = serverObservationBrowserQueryState;
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

export const serverObservationBrowserQueryEnd = new Date("2026-10-11T00:00:00.000Z");
export const serverObservationBrowserQueryExact = "2026-10-10T23:59:00.123456Z";

export const serverObservationBrowserQueryFilters = {
  end: serverObservationBrowserQueryEnd,
  query: "",
  players: "all" as const,
  password: "all" as const,
  responding: "all" as const,
};

export const serverObservationBrowserQueryServer = [
  "server",
  "Server",
  "server",
  "public",
  "active",
  0,
];

export function serverObservationBrowserQueryRow(id: string) {
  return [id, serverObservationBrowserQueryExact, 0, 64, "mode", "map", "1.6", false, null];
}

export function serverObservationBrowserQueryContext(
  access: "public" | "managed" = "public",
  actor = "",
  extra: Partial<typeof serverObservationBrowserQueryFilters> = {},
) {
  const input = { ...serverObservationBrowserQueryFilters, ...extra };
  return createHash("sha256")
    .update(
      JSON.stringify([
        1,
        "server-observation-browser",
        "server",
        access,
        actor,
        24,
        serverObservationBrowserQueryEnd.toISOString(),
        input.query,
        input.players,
        input.password,
        input.responding,
      ]),
    )
    .digest("hex");
}

function resetServerObservationBrowserQueryState() {
  const state = serverObservationBrowserQueryState;
  const end = serverObservationBrowserQueryEnd;
  vi.useFakeTimers();
  vi.setSystemTime(end);
  state.queries = [];
  state.config = null;
  state.rows = [
    [serverObservationBrowserQueryServer],
    [serverObservationBrowserQueryRow("obs")],
  ];
}

export function installServerObservationBrowserQueryHooks() {
  beforeEach(() => {
    resetServerObservationBrowserQueryState();
  });
  afterEach(() => vi.useRealTimers());
}
