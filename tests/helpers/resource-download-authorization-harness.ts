import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";
import type { Build } from "@nexus/domain";
import { builds } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for resource-download-authorization session suites. */
export const resourceDownloadAuthorizationState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceDownloadAuthorizationDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const state = resourceDownloadAuthorizationState;
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetResourceDownloadAuthorizationState() {
  resourceDownloadAuthorizationState.queries = [];
  resourceDownloadAuthorizationState.results = [];
}

export const resourceDownloadAuthorizationNow = new Date("2026-10-10T12:00:00Z");
export const resourceDownloadAuthorizationToken = "download-initiating-session";

export const resourceDownloadAuthorizationExpected = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "published",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: resourceDownloadAuthorizationNow,
  storageKey: "private.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 10,
  fileName: "resource.zip",
  mimeType: "application/zip",
} as Build;

export function resourceDownloadAuthorizationBuildRow(changes: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    ...resourceDownloadAuthorizationExpected,
    ...changes,
  };
  return Object.keys(getTableColumns(builds)).map((key) => value[key] ?? null);
}

export function resourceDownloadAuthorizationWrites() {
  return resourceDownloadAuthorizationState.queries.filter((query) =>
    query.sql.startsWith("insert"),
  );
}

export function resourceDownloadAuthorizationTokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function installResourceDownloadAuthorizationHooks() {
  beforeEach(() => {
    resetResourceDownloadAuthorizationState();
    vi.useFakeTimers();
    vi.setSystemTime(resourceDownloadAuthorizationNow);
  });
  afterEach(() => vi.useRealTimers());
}
