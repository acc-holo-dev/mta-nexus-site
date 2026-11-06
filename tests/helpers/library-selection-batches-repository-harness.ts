import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, vi } from "vitest";
import { librarySelectionBatchReceipts } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for library-selection-batches-repository suites. */
export const librarySelectionBatchesRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
  access: vi.fn(),
  session: vi.fn(),
  sessionQueryCount: 0,
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createLibrarySelectionBatchesRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = librarySelectionBatchesRepositoryState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
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

export function resetLibrarySelectionBatchesRepositoryState() {
  const state = librarySelectionBatchesRepositoryState;
  state.queries = [];
  state.rows = [];
  state.options = [];
  state.sessionQueryCount = 0;
  vi.clearAllMocks();
  state.session.mockImplementation(async () => {
    state.sessionQueryCount = state.queries.length;
  });
  state.access.mockResolvedValue({ source: "entitlement", expiresAt: null });
}

export function installLibrarySelectionBatchesRepositoryHooks() {
  beforeEach(() => {
    resetLibrarySelectionBatchesRepositoryState();
  });
}

export const librarySelectionBatchesRepositoryDate = "2026-10-12T00:00:00.000Z";

export const librarySelectionBatchesRepositoryChoice = {
  mode: "fixed" as const,
  productIds: ["prd_a"],
};

export const librarySelectionBatchesRepositoryCollection = ["lcol_a", "Core", "active", 4];

export const librarySelectionBatchesRepositoryRow = {
  productId: "prd_a",
  title: "Core",
  version: "1",
  targetBuildId: "bld_a",
  revision: 0,
  mode: "latest",
  buildId: null,
  hash: "a".repeat(64),
  size: 10,
};

export function librarySelectionBatchesRepositoryCommand(previewDigest: string) {
  return {
    ...librarySelectionBatchesRepositoryChoice,
    requestId: "f88ec3b3-b1f8-4af8-87b9-3f9f6f6cba92",
    previewDigest,
  };
}

export function librarySelectionBatchesRepositoryPreviewRows() {
  const c = librarySelectionBatchesRepositoryCollection;
  const date = librarySelectionBatchesRepositoryDate;
  const row = librarySelectionBatchesRepositoryRow;
  return [[], [], [["usr_a"]], [c], [["prd_a"]], [{ observedAt: date }], [row]] as unknown[][];
}

export function librarySelectionBatchesRepositoryCommandRows() {
  const c = librarySelectionBatchesRepositoryCollection;
  const date = librarySelectionBatchesRepositoryDate;
  const row = librarySelectionBatchesRepositoryRow;
  return [
    [],
    [],
    [],
    [],
    [["usr_a"]],
    [c],
    [],
    [[0]],
    [["usr_a"]],
    [c],
    [["prd_a"]],
    [["prd_a"]],
    [],
    [{ observedAt: date }],
    [row],
    [["bld_a"]],
    [{ observedAt: date }],
    [row],
    [["usr_a"]],
    [c],
    [["prd_a"]],
    [{ observedAt: date }],
    [row],
  ] as unknown[][];
}

export function librarySelectionBatchesRepositoryRecord(previewDigest: string) {
  const cmd = librarySelectionBatchesRepositoryCommand(previewDigest);
  const date = librarySelectionBatchesRepositoryDate;
  return {
    id: "lsbr_a",
    userId: "usr_a",
    collectionId: "lcol_a",
    requestId: cmd.requestId,
    commandDigest: createHash("sha256")
      .update(
        JSON.stringify({
          collectionId: "lcol_a",
          command: {
            mode: cmd.mode,
            productIds: cmd.productIds,
            requestId: cmd.requestId,
            previewDigest: cmd.previewDigest,
          },
        }),
      )
      .digest("hex"),
    command: cmd,
    snapshot: {
      collectionId: "lcol_a",
      collectionRevision: 4,
      mode: "fixed",
      items: [
        {
          productId: "prd_a",
          previous: { revision: 0, mode: "latest", buildId: null },
          next: { revision: 1, mode: "fixed", buildId: "bld_a" },
        },
      ],
    },
    createdAt: date,
  };
}

export function librarySelectionBatchesRepositoryRecordRow(
  r: ReturnType<typeof librarySelectionBatchesRepositoryRecord>,
) {
  return Object.keys(getTableColumns(librarySelectionBatchReceipts)).map(
    (k) => r[k as keyof typeof r],
  );
}

export function librarySelectionBatchesRepositoryInput(digest: string) {
  return {
    userId: "usr_a",
    currentToken: "browser-token",
    collectionId: "lcol_a",
    command: librarySelectionBatchesRepositoryCommand(digest),
    receiptId: "lsbr_a",
    auditId: "aud_a",
  };
}

export function librarySelectionBatchesRepositoryText() {
  return librarySelectionBatchesRepositoryState.queries.map((q) => q.sql).join("\n");
}
