import { createHash } from "node:crypto";
import { beforeEach, vi } from "vitest";

/** Shared pg-proxy query capture for community-report-groups query suites. */
export const communityReportGroupsQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createCommunityReportGroupsQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    communityReportGroupsQueryState.queries.push({ sql, params });
    if (communityReportGroupsQueryState.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (communityReportGroupsQueryState.rows.shift() ?? [])
          : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            communityReportGroupsQueryState.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

/** Factory for notifications mock from suite files under `tests/`. */
export function createCommunityReportGroupsQueryNotificationsMock() {
  return {
    notificationRepository: {
      createWithPushOutboxWithin: async () => ({ notification: null }),
    },
  };
}

/** Factory for initiating-session mock from suite files under `tests/`. */
export function createCommunityReportGroupsQueryInitiatingSessionMock() {
  return { lockInitiatingSession: vi.fn() };
}

function resetCommunityReportGroupsQueryState() {
  communityReportGroupsQueryState.queries = [];
  communityReportGroupsQueryState.rows = [];
  communityReportGroupsQueryState.config = undefined;
  communityReportGroupsQueryState.failAudit = false;
}

export function installCommunityReportGroupsQueryHooks() {
  beforeEach(() => {
    resetCommunityReportGroupsQueryState();
  });
}

export const communityReportGroupsQueryStamp = "2026-10-12T00:00:00.123456Z";
export const communityReportGroupsQueryBase = {
  period: "30" as const,
  group: "all" as const,
  query: "",
  view: "pending" as const,
};
export const communityReportGroupsQueryInput = {
  items: [{ id: "report", expectedStatus: "open" as const }],
  action: "resolve" as const,
  notes: "Reviewed reason",
};
const communityReportGroupsQueryDigest = "a".repeat(64);

export function communityReportGroupsQueryContext(
  actor = "staff",
  view = "pending",
  target = "",
  type = "",
  query = "",
) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        1,
        `community-report-groups:${view}:${target}:${type}`,
        actor,
        actor,
        "30",
        "all",
        query,
      ]),
    )
    .digest("hex");
}

export const communityReportGroupsQueryCursor = {
  version: 1 as const,
  context: communityReportGroupsQueryContext(),
  until: communityReportGroupsQueryStamp,
  id: "anchor",
};

export function communityReportGroupsQueryGroup(
  targetType = "content",
  targetId = "post",
  anchor = "anchor",
) {
  return [
    targetType,
    targetId,
    anchor,
    communityReportGroupsQueryStamp,
    communityReportGroupsQueryStamp,
    "2",
    "1",
    "3",
    "4",
  ];
}

export function communityReportGroupsQueryPublicationRows(
  extra: {
    role?: string;
    finalRole?: string;
    digest?: string;
    reportDigest?: string;
    status?: string;
  } = {},
) {
  communityReportGroupsQueryState.rows = [
    [[extra.role ?? "moderator"]],
    [
      [
        "post",
        "published",
        "Title",
        "Full publication",
        false,
        extra.digest ?? communityReportGroupsQueryDigest,
      ],
    ],
    [[extra.finalRole ?? "moderator"]],
    [
      [
        "report",
        extra.status ?? "open",
        "abuse",
        "Reason",
        communityReportGroupsQueryStamp,
        extra.reportDigest ?? communityReportGroupsQueryDigest,
        "private-reporter",
      ],
    ],
  ];
}
