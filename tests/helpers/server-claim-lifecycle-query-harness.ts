import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach } from "vitest";
import { serverClaimChallenges, servers, verificationRequests } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for server-claim-lifecycle-query suites. */
export const serverClaimLifecycleQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  now: "2026-10-10T12:00:00.000Z",
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createServerClaimLifecycleQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    serverClaimLifecycleQueryState.queries.push({ sql, params });
    // Moderation now validates the independent reviewer's live role before and
    // after the existing control-proof checks; keep target fixtures separate.
    if (sql.startsWith('select "role" from "users"') && params[0] === "moderator")
      return { rows: [["moderator"]] };
    if (sql.startsWith('select "id" from "users"') && params[0] === "manager")
      return { rows: [["manager"]] };
    if (sql.startsWith('select "id" from "server_claim_challenges"') && sql.includes("for update"))
      return { rows: [] };
    // The initiating-session lock is not part of the claim-target fixtures.
    if (sql.includes('from "sessions"') && sql.includes("for update"))
      return { rows: [["ses_moderator", "2099-01-01T00:00:00.000Z"]] };
    // These retained server-control cases predate application evidence edits.
    // The new read-only evidence lookup has no row; do not consume target fixtures.
    if (
      sql.startsWith("select") &&
      sql.includes('from "audit_events"') &&
      params.includes("verification.application_updated")
    )
      return { rows: [] };
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (serverClaimLifecycleQueryState.rows.shift() ?? [])
          : [],
    };
  });
  const { PgDialect } = await import("drizzle-orm/pg-core");
  const dialect = new PgDialect();
  const proxy: typeof database = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return async (callback: (tx: typeof database) => unknown) => callback(proxy);
      if (key === "execute")
        return async (query: Parameters<typeof dialect.sqlToQuery>[0]) => {
          serverClaimLifecycleQueryState.queries.push(dialect.sqlToQuery(query));
          return [{ now: serverClaimLifecycleQueryState.now }];
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
}

/** Factory for web-push-admission-recovery mock from suite files under `tests/`. */
export function createServerClaimLifecycleQueryWebPushMock() {
  return {
    enqueueWebPushWithRecoveryWithin: async () => ({ queued: 0, reason: "no_subscriptions" }),
  };
}

function resetServerClaimLifecycleQueryState() {
  serverClaimLifecycleQueryState.queries = [];
  serverClaimLifecycleQueryState.rows = [];
}

export function installServerClaimLifecycleQueryHooks() {
  beforeEach(() => {
    resetServerClaimLifecycleQueryState();
  });
}

function serverClaimLifecycleQueryRow(table: PgTable, values: Record<string, unknown>) {
  return Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
}

export function serverClaimLifecycleQueryServer(extra: Record<string, unknown> = {}) {
  return serverClaimLifecycleQueryRow(servers, {
    id: "srv_a",
    name: "Server",
    slug: "server",
    ipAddress: "198.51.100.8",
    port: 22003,
    endpointRevision: 2,
    ownerId: null,
    organizationId: "org_a",
    isVerified: false,
    createdAt: serverClaimLifecycleQueryState.now,
    updatedAt: serverClaimLifecycleQueryState.now,
    ...extra,
  });
}

export function serverClaimLifecycleQueryProof(extra: Record<string, unknown> = {}) {
  return serverClaimLifecycleQueryRow(serverClaimChallenges, {
    id: "scc_11111111-1111-4111-8111-111111111111",
    serverId: "srv_a",
    requesterId: "manager",
    tokenDigest: "a".repeat(64),
    proofVersion: 1,
    endpointRevision: 2,
    claimScopeRecorded: true,
    claimOrganizationId: "org_a",
    createdAt: "2026-10-10T11:59:59.000Z",
    expiresAt: "2026-10-10T12:10:00.000Z",
    ...extra,
  });
}

export function serverClaimLifecycleQueryRequest(extra: Record<string, unknown> = {}) {
  return serverClaimLifecycleQueryRow(verificationRequests, {
    id: "ver_a",
    requesterId: "manager",
    targetType: "server",
    targetId: "srv_a",
    status: "approved",
    createdAt: serverClaimLifecycleQueryState.now,
    resolvedAt: serverClaimLifecycleQueryState.now,
    ...extra,
  });
}

export function serverClaimLifecycleQueryWrites(table: string) {
  return serverClaimLifecycleQueryState.queries.filter((query) =>
    new RegExp(`^(?:insert into|update) "${table}"`).test(query.sql),
  );
}
