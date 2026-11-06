import { createHash } from "node:crypto";
import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for discovery-moderation-query suites. */
export const discoveryModerationQueryState = {
  rows: [] as unknown[][][],
  queries: [] as { sql: string; params: unknown[] }[],
  transactions: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createDiscoveryModerationQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = discoveryModerationQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetDiscoveryModerationQueryState() {
  discoveryModerationQueryState.rows = [];
  discoveryModerationQueryState.queries = [];
  discoveryModerationQueryState.transactions = [];
}

export function installDiscoveryModerationQueryHooks() {
  beforeEach(() => {
    resetDiscoveryModerationQueryState();
  });
}

export const discoveryModerationQueryTime = "2026-10-11T00:00:00.123456Z";

export function discoveryModerationQueryContext(parts: unknown[]) {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}
