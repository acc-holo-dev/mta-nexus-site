import { createHash } from "node:crypto";
import type { Build } from "@nexus/domain";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { builds } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for build-upload-recovery session suites. */
export const buildUploadRecoveryAuthorizationState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createBuildUploadRecoveryAuthorizationDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = buildUploadRecoveryAuthorizationState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction") return (run: (tx: typeof database) => unknown) => run(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetBuildUploadRecoveryAuthorizationState() {
  buildUploadRecoveryAuthorizationState.queries = [];
  buildUploadRecoveryAuthorizationState.rows = [];
}

export function installBuildUploadRecoveryAuthorizationHooks() {
  beforeEach(() => {
    resetBuildUploadRecoveryAuthorizationState();
  });
}

export const buildUploadRecoveryAuthorizationPending: Omit<Build, "createdAt"> = {
  id: "pending",
  productId: "product",
  version: "2.0.0",
  status: "pending_review",
  storageKey: "private/pending.zip",
  fileName: "pending.zip",
  mimeType: "application/zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 4,
  scanStatus: "clean",
  scanner: "fixture",
  scannedAt: new Date("2026-10-14T00:00:00Z"),
  isSigned: false,
};

export const buildUploadRecoveryAuthorizationAudit = {
  id: "audit",
  actorId: "author",
  actorType: "user" as const,
  action: "build.submitted_for_review",
  targetId: "pending",
  targetType: "build",
};

export const buildUploadRecoveryAuthorizationToken = "upload-initiating-session";

export function buildUploadRecoveryAuthorizationWrites(table: string) {
  return buildUploadRecoveryAuthorizationState.queries.filter((query) =>
    new RegExp(`^(?:insert into|update) "${table}"`).test(query.sql),
  );
}

export function buildUploadRecoveryAuthorizationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function buildUploadRecoveryAuthorizationLiveRows(
  session: unknown[][] = [["ses_author", "2099-01-01T00:00:00.000Z"]],
) {
  const pending = buildUploadRecoveryAuthorizationPending;
  const values: Record<string, unknown> = { ...pending, createdAt: new Date() };
  const buildRow = Object.keys(getTableColumns(builds)).map((key) => {
    const value = values[key];
    return value instanceof Date ? value.toISOString() : (value ?? null);
  });
  buildUploadRecoveryAuthorizationState.rows = [
    [["product", "published", "author", null, false]],
    [["author", "developer"]],
    session,
    [buildRow],
    [["approved"]],
    [],
  ];
}
