import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for bulk-server-visibility-query suites. */
export const bulkServerVisibilityQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  auditFailure: false,
  transactions: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createBulkServerVisibilityQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = bulkServerVisibilityQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.auditFailure && sql.startsWith('insert into "audit_events"'))
      throw Error("mandatory audit failed");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetBulkServerVisibilityQueryState() {
  const state = bulkServerVisibilityQueryState;
  state.queries = [];
  state.rows = [];
  state.auditFailure = false;
  state.transactions = [];
}

export const bulkServerVisibilityQueryTime = "2026-10-12T00:00:00.123456Z";
export const bulkServerVisibilityQueryNext = "2026-10-12T00:00:00.124456Z";

export const bulkServerVisibilityQueryInput = {
  serverIds: ["c", "b", "a"],
  visibility: "private" as const,
};

export function bulkServerVisibilityQueryRecords() {
  return [
    ["a", "Personal", "actor", null, "maintenance", "public", bulkServerVisibilityQueryTime],
    ["b", "Team B", null, "org", "active", "public", bulkServerVisibilityQueryTime],
    ["c", "Team C", null, "org", "suspended", "unlisted", bulkServerVisibilityQueryTime],
  ];
}

export function prepareBulkServerVisibilityQuery(rows = bulkServerVisibilityQueryRecords()) {
  bulkServerVisibilityQueryState.rows = [
    rows,
    [["user"]],
    [["org", "owner"]],
    [["org", "developer", ["manage_products", "manage_servers"]]],
  ];
}

export function bulkServerVisibilityQueryWrites() {
  return bulkServerVisibilityQueryState.queries.filter((row) =>
    /^(insert|update|delete)/u.test(row.sql),
  );
}

export function installBulkServerVisibilityQueryHooks() {
  beforeEach(() => {
    resetBulkServerVisibilityQueryState();
    prepareBulkServerVisibilityQuery();
  });
}
