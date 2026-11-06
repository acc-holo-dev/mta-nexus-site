import { createHash } from "node:crypto";
import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for notification-inbox-history-query suites. */
export const notificationInboxHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createNotificationInboxHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const proxy = drizzle(async (sql, params) => {
    notificationInboxHistoryQueryState.queries.push({ sql, params });
    return { rows: notificationInboxHistoryQueryState.rows.shift() ?? [] };
  });
  return {
    db: {
      transaction: async (callback: (tx: typeof proxy) => unknown, options: unknown) => {
        notificationInboxHistoryQueryState.options.push(options);
        return callback(proxy);
      },
    },
  };
}

export function resetNotificationInboxHistoryQueryState() {
  notificationInboxHistoryQueryState.queries = [];
  notificationInboxHistoryQueryState.rows = [];
  notificationInboxHistoryQueryState.options = [];
}

export function installNotificationInboxHistoryQueryHooks() {
  beforeEach(() => {
    resetNotificationInboxHistoryQueryState();
  });
}

export const notificationInboxHistoryQueryFilters = {
  query: "",
  state: "all" as const,
  category: "all",
};

export function notificationInboxHistoryQueryHash(
  actor = "actor",
  input = notificationInboxHistoryQueryFilters,
) {
  return createHash("sha256")
    .update(
      JSON.stringify([1, "notification-inbox", actor, input.query, input.state, input.category]),
    )
    .digest("hex");
}

export function notificationInboxHistoryQueryRow(
  id: string,
  time = "2026-10-11T00:00:00.123456Z",
) {
  return [id, "Title", "Message", null, null, false, "system", false, time];
}

export const notificationInboxHistoryQueryAsOf = "2026-10-13T00:00:00.123456Z";
export const notificationInboxHistoryQueryWindowFrom = "2026-10-06T00:00:00.123456Z";

export function notificationInboxHistoryQueryPeriodHash(
  period = "7",
  anchor = notificationInboxHistoryQueryAsOf,
  actor = "actor",
) {
  return createHash("sha256")
    .update(
      JSON.stringify([2, "notification-inbox", actor, "", "all", "all", period, anchor]),
    )
    .digest("hex");
}
