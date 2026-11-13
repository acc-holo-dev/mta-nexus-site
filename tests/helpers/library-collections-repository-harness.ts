import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { libraryCollectionReceipts } from "../../site/packages/db/src/schema";
import type {
  LibraryCollectionCommand,
  LibraryCollectionSnapshot,
} from "../../site/packages/domain/src/library-collections";

/** Shared pg-proxy query capture for library-collections-repository suites. */
export const libraryCollectionsRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
  failAudit: false,
};

/** Factory for `vi.mock("../../site/packages/db/src/client", …)` from suite files under `tests/unit` or `tests/database`. */
export async function createLibraryCollectionsRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = libraryCollectionsRepositoryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (sql.includes('from "sessions"')) return { rows: [["ses_a", "2099-01-01T00:00:00Z"]] };
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failed");
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

export function resetLibraryCollectionsRepositoryState() {
  const state = libraryCollectionsRepositoryState;
  state.queries = [];
  state.rows = [];
  state.options = [];
  state.failAudit = false;
}

export const date = "2026-10-11T00:00:00.000Z";
export const requestId = "67ca0352-de64-4af9-9e54-7d3c56fe8d89";

export const collection: LibraryCollectionSnapshot = {
  id: "lcol_a",
  name: "Core",
  status: "active" as const,
  revision: 1,
};

export const create = { requestId, action: "create" as const, name: "Core" };

export const collectionRow = (v: Record<string, unknown> = {}) => {
  const c = { ...collection, ...v };
  return [c.id, c.name, c.status, c.revision, date, date];
};

export const record = (command: LibraryCollectionCommand, snapshot = collection) => ({
  id: "lcr_a",
  userId: "usr_a",
  requestId,
  collectionId: collection.id,
  commandDigest: createHash("sha256").update(JSON.stringify(command)).digest("hex"),
  command,
  snapshot,
  createdAt: date,
});

export const recordRow = (r: ReturnType<typeof record>) =>
  Object.keys(getTableColumns(libraryCollectionReceipts)).map((k) => r[k as keyof typeof r]);

export const insertedReceipt = (command: LibraryCollectionCommand, snapshot = collection) => [
  "lcr_a",
  requestId,
  command,
  snapshot,
  date,
];

export const input = (command: LibraryCollectionCommand = create) => ({
  userId: "usr_a",
  currentToken: "session_a",
  command,
  ...(command.action === "create" || command.action === "duplicate"
    ? {}
    : { collectionId: "lcol_a" }),
  newCollectionId: "lcol_a",
  receiptId: "lcr_a",
  auditId: "aud_a",
});

export const prefix = () => [[], [], [], [["usr_a"]], []] as unknown[][];

export const sqlText = () => libraryCollectionsRepositoryState.queries.map((q) => q.sql).join("\n");
