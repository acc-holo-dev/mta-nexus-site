import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { libraryMembershipBatchReceipts } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for library-membership-batches-repository suites. */
export const libraryMembershipBatchesRepositoryState = {
  rows: [] as unknown[][],
  queries: [] as { sql: string; params: unknown[] }[],
  options: [] as unknown[],
  apply: vi.fn(),
  failAudit: false,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibraryMembershipBatchesRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = libraryMembershipBatchesRepositoryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"')) return { rows: [["ses_a", "2099-01-01T00:00:00Z"]] };
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failed");
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            state.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetLibraryMembershipBatchesRepositoryState() {
  const state = libraryMembershipBatchesRepositoryState;
  state.rows = [];
  state.queries = [];
  state.options = [];
  state.failAudit = false;
  state.apply.mockReset();
  state.apply.mockImplementation(async (_tx, i) => ({
    replayed: false,
    receipt: {
      id: i.receiptId,
      requestId: i.command.requestId,
      command: i.command,
      collection: {
        id: i.collectionId,
        name: "Core",
        status: "active",
        revision: i.command.expectedRevision + 1,
      },
      createdAt: new Date(libraryMembershipBatchesRepositoryDate),
    },
  }));
}

export function installLibraryMembershipBatchesRepositoryHooks() {
  beforeEach(() => {
    resetLibraryMembershipBatchesRepositoryState();
  });
}

export const libraryMembershipBatchesRepositoryDate = "2026-10-12T00:00:00.000Z";
export const libraryMembershipBatchesRepositoryRequestId =
  "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export const libraryMembershipBatchesRepositoryChange = {
  collectionId: "lcol_a",
  expectedRevision: 2,
  wasInCollection: true,
  inCollection: false,
};

export function libraryMembershipBatchesRepositoryInput(
  changes = [libraryMembershipBatchesRepositoryChange],
) {
  const requestId = libraryMembershipBatchesRepositoryRequestId;
  return {
    userId: "usr_a",
    currentToken: "session_a",
    productId: "prd_a",
    command: { requestId, changes },
    receiptId: "lmb_a",
    auditId: "aud_parent",
    children: changes.map((c, i) => ({
      collectionId: c.collectionId,
      receiptId: `lcr_${i}`,
      auditId: `aud_${i}`,
    })),
  };
}

export function libraryMembershipBatchesRepositoryPrefix() {
  return [[], [], [], [["usr_a"]], [], [[0]]] as unknown[][];
}

export function libraryMembershipBatchesRepositoryText() {
  return libraryMembershipBatchesRepositoryState.queries.map((q) => q.sql).join("\n");
}

export function libraryMembershipBatchesRepositoryRecordRow(record: {
  id: string;
  userId: string;
  requestId: string;
  productId: string;
  commandDigest: string;
  command: unknown;
  childReceiptIds: string[];
  createdAt: string;
}) {
  return Object.keys(getTableColumns(libraryMembershipBatchReceipts)).map(
    (k) => record[k as keyof typeof record],
  );
}

export function libraryMembershipBatchesRepositoryDigest(
  productId: string,
  command: unknown,
) {
  return createHash("sha256")
    .update(JSON.stringify({ productId, command }))
    .digest("hex");
}
