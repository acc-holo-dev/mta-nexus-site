import type { Build, ResourceVariantCommand } from "@nexus/domain";
import { getTableColumns } from "drizzle-orm";
import type { builds, products, productVariantGroups } from "../../packages/db/src/schema";

/** Shared pg-proxy query capture for resource-management repository suites. */
export const resourceManagementState = {
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../../packages/db/src/client", …)` from suite files under `site/tests/unit` or `site/tests/database`. */
export async function createResourceManagementDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    resourceManagementState.queries.push({ sql, params });
    return { rows: resourceManagementState.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            resourceManagementState.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

export function resetResourceManagementState() {
  resourceManagementState.queries = [];
  resourceManagementState.results = [];
  resourceManagementState.options = [];
}

export const revision = "2026-10-10T00:00:00.000Z";
export const updated = "2026-10-10T00:00:00.001Z";

export const actor = { id: "usr_a", role: "developer" as const };
export const input = {
  productId: "prd_a",
  actorId: actor.id,
  groupId: "vgrp_new",
  auditId: "aud_a",
};

export const save: Extract<ResourceVariantCommand, { action: "save" }> = {
  action: "save",
  expectedGroupId: null,
  expectedRevision: 0,
  title: "Resource editions",
  variants: [
    { productId: "prd_a", label: "Base" },
    { productId: "prd_b", label: "Lite" },
  ],
  reason: "Group related resources",
};

export function row(
  table: typeof products | typeof builds | typeof productVariantGroups,
  values: Record<string, unknown>,
) {
  return Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
}

export const parent = {
  id: "prd_a",
  authorId: actor.id,
  organizationId: null,
  price: 0,
  slug: "resource-a",
  status: "published",
  updatedAt: revision,
  compatibility: {},
};

export const artifact = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "pending_review",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: new Date(revision),
  storageKey: "private/artifact.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 4,
  fileName: "artifact.zip",
  mimeType: "application/zip",
  isSigned: false,
  createdAt: new Date(revision),
} as Build;
