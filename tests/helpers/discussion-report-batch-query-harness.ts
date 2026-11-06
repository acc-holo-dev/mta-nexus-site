import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for discussion-report-batch-query suites. */
export const discussionReportBatchQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
  reportNotice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createDiscussionReportBatchQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = discussionReportBatchQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
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

export function resetDiscussionReportBatchQueryState() {
  const state = discussionReportBatchQueryState;
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
  state.reportNotice.mockReset().mockResolvedValue({ notification: null });
  state.notice.mockReset();
}

export function installDiscussionReportBatchQueryHooks() {
  beforeEach(() => {
    resetDiscussionReportBatchQueryState();
  });
}

export const discussionReportBatchQueryTime = "2026-10-11T00:00:00.123456Z";
export const discussionReportBatchQueryDigest = createHash("sha256")
  .update("Complete comment")
  .digest("hex");

export const discussionReportBatchQueryInput = {
  items: [
    { id: "b", expectedStatus: "under_review" as const },
    { id: "a", expectedStatus: "open" as const },
  ],
  action: "resolve" as const,
  notes: "Recorded decision",
};

export function discussionReportBatchQueryRows(
  options: {
    role?: string;
    finalRole?: string;
    textDigest?: string;
    reportDigest?: string;
    status?: string;
    missing?: boolean;
    removed?: boolean;
  } = {},
) {
  const state = discussionReportBatchQueryState;
  const digest = discussionReportBatchQueryDigest;
  const time = discussionReportBatchQueryTime;
  state.rows = [
    [[options.role ?? "moderator"]],
    [["post", "archived", "Title"]],
    options.removed ? [] : [["comment", "Preview", true, options.textDigest ?? digest]],
    ...(options.removed ? [[["proof"]]] : []),
    [[options.finalRole ?? "moderator"]],
    options.missing
      ? [["a", "open", "spam", "Reason", time, "a".repeat(64), "reporter-a"]]
      : [
          [
            "a",
            options.status ?? "open",
            "spam",
            "Reason",
            time,
            options.reportDigest ?? "a".repeat(64),
            "reporter-a",
          ],
          ["b", "under_review", "spam", "Reason", time, "b".repeat(64), "reporter-b"],
        ],
  ];
}

export function discussionReportBatchQueryWrites() {
  return discussionReportBatchQueryState.queries.filter((query) =>
    /^(insert|update|delete)/u.test(query.sql),
  );
}
