import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for private-change-history-query suites. */
export const privateChangeHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createPrivateChangeHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = privateChangeHistoryQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetPrivateChangeHistoryQueryState() {
  const state = privateChangeHistoryQueryState;
  state.queries = [];
  state.rows = [];
  state.config = undefined;
}

export function installPrivateChangeHistoryQueryHooks() {
  beforeEach(() => {
    resetPrivateChangeHistoryQueryState();
  });
}

export const privateChangeHistoryQueryStamp = "2026-10-12T00:00:00.123456Z";

export const privateChangeHistoryQueryBase = {
  period: "all" as const,
  group: "all" as const,
  query: "",
};

export function privateChangeHistoryQueryFingerprint(
  scope: string,
  actor: string,
  target: string,
  period: string,
  group: string,
  query = "",
) {
  return createHash("sha256")
    .update(JSON.stringify([1, scope, actor, target, period, group, query]))
    .digest("hex");
}

export function privateChangeHistoryQueryOrg() {
  const value = {
    id: "org",
    ownerId: "owner",
    name: "Team",
    slug: "team",
    createdAt: privateChangeHistoryQueryStamp,
    updatedAt: privateChangeHistoryQueryStamp,
  };
  return Object.keys(getTableColumns(organizations)).map(
    (key) => value[key as keyof typeof value] ?? null,
  );
}
