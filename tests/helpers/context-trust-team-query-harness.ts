import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { organizations } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for context-trust-team-query suites. */
export const contextTrustTeamQueryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createContextTrustTeamQueryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = contextTrustTeamQueryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return work(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetContextTrustTeamQueryState() {
  contextTrustTeamQueryState.queries = [];
  contextTrustTeamQueryState.rows = [];
  contextTrustTeamQueryState.transactions = [];
}

export function installContextTrustTeamQueryHooks() {
  beforeEach(() => {
    resetContextTrustTeamQueryState();
  });
}

export const contextTrustTeamQueryTime = "2026-10-11T00:00:00.123456Z";

export const contextTrustTeamQueryOrg = {
  id: "org",
  name: "Team",
  slug: "team",
  description: null,
  logoUrl: null,
  websiteUrl: null,
  isVerified: false,
  ownerId: "owner",
  createdAt: contextTrustTeamQueryTime,
  updatedAt: contextTrustTeamQueryTime,
};

export function contextTrustTeamQueryAccess(actor = "owner", role = "member") {
  const org = contextTrustTeamQueryOrg;
  contextTrustTeamQueryState.rows = [
    [Object.keys(getTableColumns(organizations)).map((key) => org[key as keyof typeof org])],
  ];
  if (actor !== "owner") contextTrustTeamQueryState.rows.push([[role]]);
}

export function contextTrustTeamQueryContext(kind: string, id = "subject") {
  return createHash("sha256")
    .update(JSON.stringify([1, "public-context-approvals", kind, id]))
    .digest("hex");
}
