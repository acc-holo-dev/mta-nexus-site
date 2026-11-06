import { createHash } from "node:crypto";
import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for community-report-history-query suites. */
export const communityReportHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createCommunityReportHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = communityReportHistoryQueryState;
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

function resetCommunityReportHistoryQueryState() {
  communityReportHistoryQueryState.queries = [];
  communityReportHistoryQueryState.rows = [];
  communityReportHistoryQueryState.config = undefined;
}

export function installCommunityReportHistoryQueryHooks() {
  beforeEach(() => {
    resetCommunityReportHistoryQueryState();
  });
}

export const communityReportHistoryQueryStamp = "2026-10-12T00:00:00.123456Z";
export const communityReportHistoryQueryBase = {
  period: "all" as const,
  group: "all" as const,
  query: "",
};
export const communityReportHistoryQueryOwn = { actorId: "owner", staff: false };
export const communityReportHistoryQueryStaff = { actorId: "moderator", staff: true };
export const communityReportHistoryQueryReport = [
  "report",
  "comment",
  "private-comment",
  "abuse",
  "under_review",
  "owner",
];

export function communityReportHistoryQueryEvent(id = "event") {
  return [
    id,
    "report.review",
    communityReportHistoryQueryStamp,
    "open",
    "under_review",
    "staff",
    false,
  ];
}

export function communityReportHistoryQueryContext(
  actor = "owner",
  mode = "own",
  period = "all",
  group = "all",
) {
  return createHash("sha256")
    .update(
      JSON.stringify([1, `community-report-${mode}-history`, actor, "report", period, group, ""]),
    )
    .digest("hex");
}

export const communityReportHistoryQueryCursor = {
  version: 1 as const,
  context: communityReportHistoryQueryContext(),
  until: communityReportHistoryQueryStamp,
  id: "anchor",
};
