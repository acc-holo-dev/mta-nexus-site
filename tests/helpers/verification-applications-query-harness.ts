import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { developerExperienceRevision } from "../../packages/db/src/repositories/developer-profile";
import { verificationApplicationRevision as version } from "../../packages/db/src/repositories/verification-application-version";
import { verificationRequests } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for verification-applications-query suites. */
export const verificationApplicationsQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  options: [] as unknown[],
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createVerificationApplicationsQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    verificationApplicationsQueryState.queries.push({ sql, params });
    if (
      verificationApplicationsQueryState.failAudit &&
      sql.startsWith('insert into "audit_events"')
    )
      throw Error("audit failed");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ")
          ? (verificationApplicationsQueryState.rows.shift() ?? [])
          : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            verificationApplicationsQueryState.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

/** Factory for web-push-admission-recovery mock from suite files under `tests/`. */
export function createVerificationApplicationsQueryWebPushMock() {
  return {
    enqueueWebPushWithRecoveryWithin: async () => ({ queued: 0, reason: "no_subscriptions" }),
  };
}

function resetVerificationApplicationsQueryState() {
  verificationApplicationsQueryState.queries = [];
  verificationApplicationsQueryState.rows = [];
  verificationApplicationsQueryState.options = [];
  verificationApplicationsQueryState.failAudit = false;
}

export function installVerificationApplicationsQueryHooks() {
  beforeEach(() => {
    resetVerificationApplicationsQueryState();
  });
}

export const verificationApplicationsQueryTime = "2026-10-11T00:00:00.123456Z";
export const verificationApplicationsQueryFilters = {
  query: "",
  status: "all",
  type: "all",
};
export const verificationApplicationsQueryContext = createHash("sha256")
  .update(JSON.stringify([1, "verification-applications", "actor", "", "all", "all"]))
  .digest("hex");

export const verificationApplicationsQueryStamp = developerExperienceRevision({
  specialties: ["Lua"],
  githubUrl: "https://example.test",
});

export function verificationApplicationsQueryRequest(extra: Record<string, unknown> = {}) {
  const fields: Record<string, unknown> = {
    id: "request",
    requesterId: "actor",
    targetId: "actor",
    targetType: "developer",
    status: "pending",
    createdAt: verificationApplicationsQueryTime,
    ...extra,
  };
  return Object.keys(getTableColumns(verificationRequests)).map((key) => fields[key] ?? null);
}

export const verificationApplicationsQueryInput = {
  expectedRevision: version("request", "pending", "submission"),
  proofUrl: "https://example.test/proof",
  notes: "Complete replacement evidence",
};

export const verificationApplicationsQueryAudit = {
  id: "new-audit",
  actorId: "actor",
  actorType: "user" as const,
  action: "verification.application_updated",
  targetId: "request",
  targetType: "verification",
};

export function verificationApplicationsQueryWrites(table: string) {
  return verificationApplicationsQueryState.queries.filter(
    (query) =>
      query.sql.startsWith(`update "${table}"`) || query.sql.startsWith(`insert into "${table}"`),
  );
}
