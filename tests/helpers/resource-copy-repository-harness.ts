import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach } from "vitest";
import { products, resourceDraftCopies, users } from "../../packages/db/src/schema";
import {
  date,
  command as initialCommand,
  metadata,
  receiptId,
  sourceId,
  targetId,
} from "../resource-copy-fixtures";

/** Shared pg-proxy query capture for resource-copy-repository suites. */
export const resourceCopyRepositoryState = {
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
};

/** Factory for `vi.mock("../packages/db/src/client", …)` from suite files under `tests/`. */
export async function createResourceCopyRepositoryDbMock() {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    resourceCopyRepositoryState.queries.push({ sql, params });
    return { rows: resourceCopyRepositoryState.rows.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (fn: (tx: typeof database) => unknown, options: unknown) => {
            resourceCopyRepositoryState.options.push(options);
            return fn(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
}

function resetResourceCopyRepositoryState() {
  resourceCopyRepositoryState.queries = [];
  resourceCopyRepositoryState.rows = [];
  resourceCopyRepositoryState.options = [];
}

export function installResourceCopyRepositoryHooks() {
  beforeEach(() => {
    resetResourceCopyRepositoryState();
  });
}

export const resourceCopyRepositorySource = {
  id: sourceId,
  title: "Original resource",
  slug: "original-resource",
  ...metadata,
  status: "published",
  authorId: "usr_a",
  organizationId: null,
  price: 0,
  updatedAt: date,
} as typeof products.$inferSelect;

const resourceCopyRepositoryInitialCommand = initialCommand;

function resourceCopyRepositoryHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function resourceCopyRepositoryCommand(reviewDigest: string) {
  return { ...initialCommand, reviewDigest };
}

export function resourceCopyRepositoryRow(command: {
  requestId: string;
  reviewDigest: string;
  title: string;
  slug: string;
}) {
  return {
    id: receiptId,
    actorId: "usr_a",
    requestId: command.requestId,
    sourceProductId: sourceId,
    targetProductId: targetId,
    commandDigest: resourceCopyRepositoryHash({
      sourceId,
      reviewDigest: command.reviewDigest,
      title: command.title,
      slug: command.slug,
    }),
    createdAt: date,
    snapshot: {
      version: 1,
      source: { id: sourceId, title: resourceCopyRepositorySource.title },
      target: {
        id: targetId,
        title: command.title,
        slug: command.slug,
        createdStatus: "draft",
      },
      metadata,
    },
  } as typeof resourceDraftCopies.$inferSelect;
}

export function resourceCopyRepositoryProduct(
  values: typeof resourceCopyRepositorySource = resourceCopyRepositorySource,
) {
  return Object.keys(getTableColumns(products)).map((key) => {
    const v = (values as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : (v ?? null);
  });
}

export function resourceCopyRepositoryRecord(values: ReturnType<typeof resourceCopyRepositoryRow>) {
  return Object.keys(getTableColumns(resourceDraftCopies)).map((key) => {
    const v = (values as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : v;
  });
}

export function resourceCopyRepositoryUser(role = "developer", verified = false) {
  const actor = { id: "usr_a", role, isVerified: verified };
  return Object.keys(getTableColumns(users)).map(
    (key) => (actor as Record<string, unknown>)[key] ?? null,
  );
}

export function resourceCopyRepositoryInserts() {
  return resourceCopyRepositoryState.queries.filter((q) => q.sql.startsWith("insert"));
}

export {
  date as resourceCopyRepositoryDate,
  metadata as resourceCopyRepositoryMetadata,
  receiptId as resourceCopyRepositoryReceiptId,
  sourceId as resourceCopyRepositorySourceId,
  targetId as resourceCopyRepositoryTargetId,
};
