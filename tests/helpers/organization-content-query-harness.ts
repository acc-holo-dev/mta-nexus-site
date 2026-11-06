import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { content, organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for organization-content-query suites. */
export const organizationContentQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrganizationContentQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = organizationContentQueryState;
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

export function resetOrganizationContentQueryState() {
  const state = organizationContentQueryState;
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
}

export function installOrganizationContentQueryHooks() {
  beforeEach(() => {
    resetOrganizationContentQueryState();
  });
}

export const organizationContentQueryTime = "2026-10-11T00:00:00.000Z";
export const organizationContentQueryLater = "2026-10-11T00:00:00.001Z";

export function organizationContentQueryOrg(ownerId = "actor") {
  return Object.keys(getTableColumns(organizations)).map(
    (key) =>
      (
        ({
          id: "org",
          ownerId,
          name: "Team",
          slug: "team",
          createdAt: organizationContentQueryTime,
          updatedAt: organizationContentQueryTime,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
}

export function organizationContentQueryPublication(extra: Record<string, unknown> = {}) {
  return Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "content",
          authorId: "original",
          organizationId: "org",
          type: "article",
          status: "published",
          slug: "published",
          title: "Original",
          body: "Original publication",
          tags: [],
          updatedAt: organizationContentQueryTime,
          createdAt: organizationContentQueryTime,
          publishedAt: organizationContentQueryTime,
          commentCount: 4,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
}

export const organizationContentQueryFields = {
  title: "New title",
  body: "New publication text",
  tags: ["Lua"],
  excerpt: "",
  coverImageUrl: "",
};

export const organizationContentQueryAudit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetType: "content",
  targetId: "content",
  action: "content.edited_by_organization",
  details: { organizationId: "org" },
};

export function organizationContentQueryWrites() {
  return organizationContentQueryState.queries.filter((q) =>
    /^(insert|update|delete)/u.test(q.sql),
  );
}
