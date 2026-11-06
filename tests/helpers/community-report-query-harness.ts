import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for community-report query suites. */
export const communityReportQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
  reportNotice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createCommunityReportQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    communityReportQueryState.queries.push({ sql, params });
    if (communityReportQueryState.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return { rows: communityReportQueryState.rows.shift() ?? [] };
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

/** Factory for discussion-moderation-notice mock from suite files under `tests/`. */
export function createCommunityReportQueryNoticeMock() {
  return { discussionModerationNotice: communityReportQueryState.notice };
}

/** Factory for notifications mock from suite files under `tests/`. */
export function createCommunityReportQueryNotificationsMock() {
  return {
    notificationRepository: {
      createWithPushOutboxWithin: communityReportQueryState.reportNotice,
    },
  };
}

/** Factory for initiating-session mock from suite files under `tests/`. */
export function createCommunityReportQueryInitiatingSessionMock() {
  return { lockInitiatingSession: vi.fn() };
}

function resetCommunityReportQueryState() {
  communityReportQueryState.queries = [];
  communityReportQueryState.rows = [];
  communityReportQueryState.failAudit = false;
  communityReportQueryState.notice.mockReset();
  communityReportQueryState.reportNotice.mockReset().mockResolvedValue({ notification: null });
}

export function installCommunityReportQueryHooks() {
  beforeEach(() => {
    resetCommunityReportQueryState();
  });
}

const communityReportQueryTime = "2026-10-10T00:00:00Z";
export const communityReportQueryReportRow = [
  "report",
  "comment",
  "comment",
  "abuse",
  "Report reason",
  [],
  "open",
  communityReportQueryTime,
  null,
];
export const communityReportQuerySubmission = {
  actorId: "reporter",
  currentToken: "session",
  id: "report",
  auditId: "audit",
  targetType: "comment" as const,
  targetId: "comment",
  type: "abuse",
  reason: "Report reason",
  evidenceUrls: [],
};

export function communityReportQueryRemovalRows(
  extra: { role?: string; finalRole?: string; text?: string; status?: string } = {},
) {
  communityReportQueryState.rows = [
    [[extra.role ?? "moderator"]],
    [["comment", "comment"]],
    [["content", "published", "article", "post"]],
    [
      [
        "comment",
        extra.text ?? "Original",
        "author",
        createHash("sha256")
          .update(extra.text ?? "Original")
          .digest("hex"),
        false,
      ],
    ],
    [[extra.finalRole ?? "moderator"]],
    [["report", extra.status ?? "open", "reporter", "comment", "comment"]],
  ];
}

export { createHash };
