import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for organization-batch-query suites. */
export const organizationBatchQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  notice: vi.fn(),
  fail: "",
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrganizationBatchQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = organizationBatchQueryState;
  const database = drizzle(async (sql, params) => {
    if (/^select "id" from "users" where "users"\."id" = \$1 for share/u.test(sql))
      return { rows: [[params[0]]] };
    state.queries.push({ sql, params });
    if (state.fail && sql.startsWith(`insert into "${state.fail}"`))
      throw new Error("Required write unavailable");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown) => callback(proxy);
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
}

function resetOrganizationBatchQueryState() {
  const state = organizationBatchQueryState;
  state.queries = [];
  state.rows = [];
  state.fail = "";
  state.notice.mockReset().mockResolvedValue(undefined);
}

export function installOrganizationBatchQueryHooks() {
  beforeEach(() => {
    resetOrganizationBatchQueryState();
  });
}

export const organizationBatchQueryTime = "2026-10-11T00:00:00.000Z";
export const organizationBatchQueryLater = "2026-10-11T00:00:00.001Z";

export function organizationBatchQueryOrg(extra = {}) {
  return Object.keys(getTableColumns(organizations)).map(
    (key) =>
      ({
        id: "org",
        name: "Team",
        slug: "team",
        ownerId: "owner",
        createdAt: organizationBatchQueryTime,
        updatedAt: organizationBatchQueryTime,
        ...extra,
      })[key as "id"],
  );
}

export const organizationBatchQueryMembers = [
  ["m-a", "a", "member", ["manage_resources", "manage_servers"], "alice", "Alice"],
  ["m-b", "b", "developer", ["commercial_custom"], "bob", "Bob"],
];

export const organizationBatchQueryInput = {
  userIds: ["b", "a"],
  change: { action: "role", role: "developer" } as const,
  expectedUpdatedAt: new Date(organizationBatchQueryTime),
};

export const organizationBatchQueryAudits = organizationBatchQueryInput.userIds.map((id) => ({
  id: `audit-${id}`,
  actorId: "owner",
  actorType: "user" as const,
  targetType: "organization",
  targetId: "org",
  action: "organization.member_updated",
}));

export function organizationBatchQueryWrites() {
  return organizationBatchQueryState.queries.filter((query) =>
    /^(insert|update|delete)/u.test(query.sql),
  );
}
