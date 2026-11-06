import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { beforeEach } from "vitest";
import { verificationRequests } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for verification-professional query suites. */
export const verificationProfessionalQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createVerificationProfessionalQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    verificationProfessionalQueryState.queries.push({ sql, params });
    if (
      verificationProfessionalQueryState.failAudit &&
      sql.startsWith('insert into "audit_events"')
    )
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (verificationProfessionalQueryState.rows.shift() ?? [])
          : [],
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

/** Factory for web-push-admission-recovery mock from suite files under `tests/`. */
export function createVerificationProfessionalQueryPushMock() {
  return {
    enqueueWebPushWithRecoveryWithin: async () => ({
      queued: 0,
      reason: "no_subscriptions",
    }),
  };
}

export function resetVerificationProfessionalQueryState() {
  verificationProfessionalQueryState.queries = [];
  verificationProfessionalQueryState.rows = [];
  verificationProfessionalQueryState.failAudit = false;
}

export function installVerificationProfessionalQueryHooks() {
  beforeEach(() => {
    resetVerificationProfessionalQueryState();
  });
}

export const verificationProfessionalQueryTime = "2026-10-10T00:00:00.000Z";
export const verificationProfessionalQueryLater = "2026-10-10T00:00:01.000Z";

export function verificationProfessionalQueryRow(table: PgTable, values: Record<string, unknown>) {
  return Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
}

export function verificationProfessionalQueryRequest(extra = {}) {
  return verificationProfessionalQueryRow(verificationRequests, {
    id: "ver_request",
    requesterId: "developer",
    targetType: "developer",
    targetId: "developer",
    status: "approved",
    createdAt: verificationProfessionalQueryTime,
    resolvedAt: verificationProfessionalQueryLater,
    ...extra,
  });
}

export const verificationProfessionalQueryProfileInput = {
  actorId: "developer",
  currentToken: "tok_developer",
  expectedUpdatedAt: new Date(verificationProfessionalQueryTime),
  specialties: ["Lua"],
  githubUrl: "https://github.com/example",
  discordTag: "new-discord",
  profileId: "profile",
  auditId: "audit",
};

export function verificationProfessionalQueryWrites(table: string) {
  return verificationProfessionalQueryState.queries.filter(
    (query) =>
      query.sql.startsWith(`insert into "${table}"`) || query.sql.startsWith(`update "${table}"`),
  );
}
