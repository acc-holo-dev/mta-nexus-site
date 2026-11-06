import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { content, organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for organization-publication-history-query suites. */
export const organizationPublicationHistoryQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  failAudit: false,
  notice: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrganizationPublicationHistoryQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = organizationPublicationHistoryQueryState;
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
          return (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetOrganizationPublicationHistoryQueryState() {
  const state = organizationPublicationHistoryQueryState;
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
}

export function installOrganizationPublicationHistoryQueryHooks() {
  beforeEach(() => {
    resetOrganizationPublicationHistoryQueryState();
  });
}

export const organizationPublicationHistoryQueryTime = "2026-10-11T00:00:00.123456Z";
export const organizationPublicationHistoryQueryNext = "2026-10-11T00:00:00.124456Z";

export function organizationPublicationHistoryQueryOrg(ownerId = "actor") {
  return Object.keys(getTableColumns(organizations)).map(
    (key) =>
      (
        ({
          id: "org",
          ownerId,
          name: "Team",
          slug: "team",
          createdAt: organizationPublicationHistoryQueryTime,
          updatedAt: organizationPublicationHistoryQueryTime,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
}

export function organizationPublicationHistoryQueryFull(
  extra: Record<string, unknown> = {},
  revision = organizationPublicationHistoryQueryTime,
) {
  return [
    ...Object.keys(getTableColumns(content)).map(
      (key) =>
        (
          ({
            id: "post",
            slug: "post",
            title: "Title",
            body: "Private full text",
            authorId: "original-author",
            organizationId: "org",
            type: "post",
            status: "archived",
            updatedAt: organizationPublicationHistoryQueryTime,
            createdAt: organizationPublicationHistoryQueryTime,
            publishedAt: organizationPublicationHistoryQueryTime,
            ...extra,
          }) as Record<string, unknown>
        )[key] ?? null,
    ),
    revision,
  ];
}

export const organizationPublicationHistoryQueryAudit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetType: "content",
  targetId: "post",
  action: "content.restored_by_organization",
  details: { organizationId: "org" },
};

export function organizationPublicationHistoryQueryWrites() {
  return organizationPublicationHistoryQueryState.queries.filter((query) =>
    /^(insert|update|delete)/u.test(query.sql),
  );
}
