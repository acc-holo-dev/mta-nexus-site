import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for organization-governance query suites. */
export const organizationGovernanceQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: null as unknown,
  failTable: "",
  push: vi.fn(),
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createOrganizationGovernanceQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    organizationGovernanceQueryState.queries.push({ sql, params });
    if (
      organizationGovernanceQueryState.failTable &&
      sql.startsWith(`insert into "${organizationGovernanceQueryState.failTable}"`)
    )
      throw new Error("write failed");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (organizationGovernanceQueryState.rows.shift() ?? [])
          : [],
    };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (callback: (tx: typeof database) => unknown, config: unknown) => {
          if (config) organizationGovernanceQueryState.config = config;
          return callback(proxy);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
}

/** Factory for initiating-session mock from suite files under `tests/`. */
export async function createOrganizationGovernanceQueryInitiatingSessionMock(
  original: () => Promise<typeof import("../../packages/db/src/repositories/initiating-session")>,
) {
  const actual = await original();
  return {
    lockInitiatingSession: (
      tx: Parameters<typeof actual.lockInitiatingSession>[0],
      actor: string,
      token: string,
    ) =>
      token === "unit-token" ? Promise.resolve() : actual.lockInitiatingSession(tx, actor, token),
  };
}

/** Factory for web-push-admission-recovery mock from suite files under `tests/`. */
export function createOrganizationGovernanceQueryPushMock() {
  return { enqueueWebPushWithRecoveryWithin: organizationGovernanceQueryState.push };
}

function resetOrganizationGovernanceQueryState() {
  organizationGovernanceQueryState.queries = [];
  organizationGovernanceQueryState.rows = [];
  organizationGovernanceQueryState.config = null;
  organizationGovernanceQueryState.failTable = "";
  organizationGovernanceQueryState.push
    .mockReset()
    .mockResolvedValue({ queued: 0, reason: "no_subscriptions" });
}

export function installOrganizationGovernanceQueryHooks() {
  beforeEach(() => {
    resetOrganizationGovernanceQueryState();
  });
}

export const organizationGovernanceQueryTime = "2026-10-11T00:00:00.000Z";
export const organizationGovernanceQueryLater = "2026-10-11T00:00:01.000Z";

export function organizationGovernanceQueryOrg(extra = {}) {
  return Object.keys(getTableColumns(organizations)).map(
    (key) =>
      ({
        id: "org",
        name: "Team",
        slug: "team",
        ownerId: "owner",
        description: null,
        logoUrl: null,
        websiteUrl: null,
        isVerified: true,
        createdAt: organizationGovernanceQueryTime,
        updatedAt: organizationGovernanceQueryTime,
        ...extra,
      })[key as "id"],
  );
}

export const organizationGovernanceQueryInput = {
  id: "org",
  actorId: "owner",
  currentToken: "raw-owner-token",
  targetId: "target",
  targetUsername: "target",
  confirmationSlug: "team",
  expectedPasswordHash: "owner-password-hash",
  formerOwnerRole: "member" as const,
  expectedUpdatedAt: new Date(organizationGovernanceQueryTime),
  memberId: "new-membership",
  auditId: "audit",
};

export function organizationGovernanceQueryWrites(table: string) {
  return organizationGovernanceQueryState.queries.filter(
    (query) =>
      query.sql.startsWith(`insert into "${table}"`) || query.sql.startsWith(`update "${table}"`),
  );
}

export function organizationGovernanceQueryTransferRows(
  members = [
    ["old-membership", "owner", "owner"],
    ["target-membership", "target", "developer"],
  ],
) {
  organizationGovernanceQueryState.rows = [
    [organizationGovernanceQueryOrg()],
    members,
    [
      ["owner", "owner", "Owner", null, "owner-password-hash"],
      ["target", "target", "Target", null, "target-password-hash"],
    ],
    [["session", new Date(Date.now() + 3_600_000).toISOString()]],
    [
      organizationGovernanceQueryOrg({
        ownerId: "target",
        updatedAt: organizationGovernanceQueryLater,
      }),
    ],
    [["session", new Date(Date.now() + 3_600_000).toISOString()]],
  ];
}
