import { createHash } from "node:crypto";
import { beforeEach } from "vitest";

/** Shared pg-proxy query capture for library-membership-history-repository suites. */
export const libraryMembershipHistoryRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryMembershipHistoryRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    libraryMembershipHistoryRepositoryState.queries.push({ sql, params });
    return { rows: libraryMembershipHistoryRepositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            libraryMembershipHistoryRepositoryState.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetLibraryMembershipHistoryRepositoryState() {
  libraryMembershipHistoryRepositoryState.rows = [];
  libraryMembershipHistoryRepositoryState.queries = [];
  libraryMembershipHistoryRepositoryState.options = [];
}

export function installLibraryMembershipHistoryRepositoryHooks() {
  beforeEach(() => {
    resetLibraryMembershipHistoryRepositoryState();
  });
}

export const libraryMembershipHistoryRepositoryDate = "2026-10-12T00:00:00.000Z";
export const libraryMembershipHistoryRepositoryRequestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export const libraryMembershipHistoryRepositoryCommand = {
  requestId: libraryMembershipHistoryRepositoryRequestId,
  changes: [
    { collectionId: "lcol_a", expectedRevision: 2, wasInCollection: true, inCollection: false },
    { collectionId: "lcol_b", expectedRevision: 1, wasInCollection: false, inCollection: true },
  ],
};

export function libraryMembershipHistoryRepositoryDigest(
  productId = "prd_a",
  proof = libraryMembershipHistoryRepositoryCommand,
) {
  return createHash("sha256")
    .update(JSON.stringify({ productId, command: proof }))
    .digest("hex");
}

export function libraryMembershipHistoryRepositoryParent(
  cmd: unknown = libraryMembershipHistoryRepositoryCommand,
  hash = libraryMembershipHistoryRepositoryDigest(),
  productId = "prd_a",
  id = "lmb_a",
) {
  return [
    id,
    libraryMembershipHistoryRepositoryRequestId,
    productId,
    hash,
    cmd,
    ["lcr_a", "lcr_b"],
    libraryMembershipHistoryRepositoryDate,
  ];
}

export function libraryMembershipHistoryRepositoryChild(
  index: number,
  productId = "prd_a",
): unknown[] {
  const change = libraryMembershipHistoryRepositoryCommand.changes[index];
  if (!change) throw Error("Missing change");
  const uuid = `${index ? "87" : "77"}ca0352-de64-4af9-9e54-7d3c56fe8d89`;
  return [
    index ? "lcr_b" : "lcr_a",
    uuid,
    change.collectionId,
    {
      requestId: uuid,
      action: change.inCollection ? "add" : "remove",
      productId,
      expectedRevision: change.expectedRevision,
    },
    {
      id: change.collectionId,
      name: "Recorded & name",
      status: "active",
      revision: change.expectedRevision + 1,
    },
    libraryMembershipHistoryRepositoryDate,
  ];
}

export function libraryMembershipHistoryRepositoryPrefix() {
  return [[["usr_a"]], [{ observedAt: libraryMembershipHistoryRepositoryDate }]] as unknown[][];
}

export const libraryMembershipHistoryRepositoryQuery = {
  page: 1,
  days: 30 as const,
  operation: "all" as const,
};

export function libraryMembershipHistoryRepositoryText() {
  return libraryMembershipHistoryRepositoryState.queries.map((q) => q.sql).join("\n");
}
