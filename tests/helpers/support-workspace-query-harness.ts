import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { supportCases } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for support-workspace-query suites. */
export const supportWorkspaceQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  failTable: "",
  push: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createSupportWorkspaceQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    supportWorkspaceQueryState.queries.push({ sql, params });
    if (
      supportWorkspaceQueryState.failTable &&
      sql.startsWith(`insert into "${supportWorkspaceQueryState.failTable}"`)
    )
      throw new Error("storage failed");
    if (sql.includes('from "sessions"')) return { rows: [["session", "2099-01-01T00:00:00.000Z"]] };
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (supportWorkspaceQueryState.rows.shift() ?? [])
          : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown, config: unknown) => {
          if (config) supportWorkspaceQueryState.config = config;
          return callback(proxy);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
}

/** Factory for web-push-admission-recovery mock from suite files under `tests/`. */
export function createSupportWorkspaceQueryWebPushMock() {
  return { enqueueWebPushWithRecoveryWithin: supportWorkspaceQueryState.push };
}

export function resetSupportWorkspaceQueryState() {
  supportWorkspaceQueryState.queries = [];
  supportWorkspaceQueryState.rows = [];
  supportWorkspaceQueryState.config = null;
  supportWorkspaceQueryState.failTable = "";
  supportWorkspaceQueryState.push
    .mockReset()
    .mockResolvedValue({ queued: 0, reason: "no_subscriptions" });
}

export function installSupportWorkspaceQueryHooks() {
  beforeEach(() => {
    resetSupportWorkspaceQueryState();
  });
}

export const supportWorkspaceQueryId = `sup_${"a".repeat(24)}`;
export const supportWorkspaceQueryTime = "2026-10-11T00:00:00.000Z";
export const supportWorkspaceQueryLater = "2026-10-11T00:00:01.000Z";

export function supportWorkspaceQueryRow(extra = {}) {
  return Object.keys(getTableColumns(supportCases)).map(
    (key) =>
      ({
        id: supportWorkspaceQueryId,
        requesterId: "owner",
        category: "account",
        subject: "Private subject",
        status: "open",
        relatedType: null,
        relatedId: null,
        createdAt: supportWorkspaceQueryTime,
        updatedAt: supportWorkspaceQueryTime,
        ...extra,
      })[key as "id"],
  );
}

export const supportWorkspaceQueryAudit = {
  id: "audit",
  actorId: "owner",
  actorType: "user" as const,
  action: "support.case.status_changed",
  targetId: supportWorkspaceQueryId,
  targetType: "support_case",
  details: { secret: "never persist" },
};

export function supportWorkspaceQueryWrites(table: string) {
  return supportWorkspaceQueryState.queries.filter(
    (q) => q.sql.startsWith(`insert into "${table}"`) || q.sql.startsWith(`update "${table}"`),
  );
}

export const supportWorkspaceQueryReply = {
  id: "message",
  caseId: supportWorkspaceQueryId,
  authorId: "staff",
  authorRole: "staff" as const,
  body: "Sensitive reply",
  expectedStatus: "open" as const,
  expectedUpdatedAt: new Date(supportWorkspaceQueryTime),
};

export const supportWorkspaceQueryRequest = {
  actorId: "staff",
  requestKey: "request",
  operation: "reply" as const,
  fingerprint: "fingerprint",
  caseId: supportWorkspaceQueryId,
  messageId: "message",
};
