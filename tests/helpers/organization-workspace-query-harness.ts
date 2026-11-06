import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { organizationMembers, organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for organization-workspace-query suites. */
export const organizationWorkspaceQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrganizationWorkspaceQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = organizationWorkspaceQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetOrganizationWorkspaceQueryState() {
  organizationWorkspaceQueryState.queries = [];
  organizationWorkspaceQueryState.rows = [];
  organizationWorkspaceQueryState.config = null;
}

export function installOrganizationWorkspaceQueryHooks() {
  beforeEach(() => {
    resetOrganizationWorkspaceQueryState();
  });
}

export const organizationWorkspaceQueryVersion = new Date("2026-10-10T12:00:00.000Z");

export const organizationWorkspaceQueryOrganization = {
  id: "org",
  name: "Team",
  slug: "team",
  description: null,
  logoUrl: null,
  websiteUrl: null,
  isVerified: false,
  ownerId: "owner",
  createdAt: organizationWorkspaceQueryVersion.toISOString(),
  updatedAt: organizationWorkspaceQueryVersion.toISOString(),
};

export function organizationWorkspaceQueryOrgRow(overrides = {}) {
  return Object.keys(getTableColumns(organizations)).map(
    (key) =>
      ({ ...organizationWorkspaceQueryOrganization, ...overrides })[
        key as keyof typeof organizationWorkspaceQueryOrganization
      ],
  );
}

export function organizationWorkspaceQueryMemberRow(overrides = {}) {
  return Object.keys(getTableColumns(organizationMembers)).map(
    (key) =>
      ({
        id: "membership",
        organizationId: "org",
        userId: "target",
        role: "developer",
        permissions: ["manage_products", "custom", "manage_servers"],
        createdAt: organizationWorkspaceQueryVersion.toISOString(),
        ...overrides,
      })[key as "id"],
  );
}

export const organizationWorkspaceQueryFields = {
  name: "Updated team",
  description: "",
  logoUrl: "",
  websiteUrl: "",
};

export const organizationWorkspaceQueryAudit = {
  id: "audit",
  actorId: "owner",
  actorType: "user" as const,
  action: "organization.member_updated",
  targetId: "org",
  targetType: "organization",
};
