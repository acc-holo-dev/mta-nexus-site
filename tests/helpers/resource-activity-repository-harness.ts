import { getTableColumns } from "drizzle-orm";
import { afterEach, beforeEach, vi } from "vitest";
import type { Build } from "@nexus/domain";
import { builds } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for resource-activity-repository suites. */
export const resourceActivityRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceActivityRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    resourceActivityRepositoryState.queries.push({ sql, params });
    return { rows: resourceActivityRepositoryState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            resourceActivityRepositoryState.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetResourceActivityRepositoryState() {
  resourceActivityRepositoryState.queries = [];
  resourceActivityRepositoryState.results = [];
  resourceActivityRepositoryState.options = [];
}

export const resourceActivityRepositoryNow = new Date("2026-10-10T12:00:00Z");

export const resourceActivityRepositoryExpected = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "published",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: resourceActivityRepositoryNow,
  storageKey: "private.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 10,
  fileName: "resource.zip",
  mimeType: "application/zip",
} as Build;

export function resourceActivityRepositoryBuildRow(changes: Record<string, unknown> = {}) {
  const value: Record<string, unknown> = {
    ...resourceActivityRepositoryExpected,
    ...changes,
  };
  return Object.keys(getTableColumns(builds)).map((key) => value[key] ?? null);
}

export function installResourceActivityRepositoryHooks() {
  beforeEach(() => {
    resetResourceActivityRepositoryState();
    vi.useFakeTimers();
    vi.setSystemTime(resourceActivityRepositoryNow);
  });
  afterEach(() => vi.useRealTimers());
}
