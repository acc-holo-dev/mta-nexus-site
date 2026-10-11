import { createHash } from "node:crypto";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
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
});

import {
  ResourceCopiesRepository,
  resourceCopyPreview,
  resourceCopyReceipt,
} from "../packages/db/src/repositories/resource-copies";
import { products, resourceDraftCopies, users } from "../packages/db/src/schema";
import {
  date,
  command as initialCommand,
  metadata,
  receiptId,
  sourceId,
  targetId,
} from "./resource-copy-fixtures";

const repo = new ResourceCopiesRepository();
const source = {
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
const command = { ...initialCommand, reviewDigest: resourceCopyPreview(source).reviewDigest };
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const row = {
  id: receiptId,
  actorId: "usr_a",
  requestId: command.requestId,
  sourceProductId: sourceId,
  targetProductId: targetId,
  commandDigest: hash({
    sourceId,
    reviewDigest: command.reviewDigest,
    title: command.title,
    slug: command.slug,
  }),
  createdAt: date,
  snapshot: {
    version: 1,
    source: { id: sourceId, title: source.title },
    target: { id: targetId, title: command.title, slug: command.slug, createdStatus: "draft" },
    metadata,
  },
} as typeof resourceDraftCopies.$inferSelect;
function product(values = source) {
  return Object.keys(getTableColumns(products)).map((key) => {
    const v = (values as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : (v ?? null);
  });
}
function record(values = row) {
  return Object.keys(getTableColumns(resourceDraftCopies)).map((key) => {
    const v = (values as Record<string, unknown>)[key];
    return v instanceof Date ? v.toISOString() : v;
  });
}
function user(role = "developer", verified = false) {
  const actor = { id: "usr_a", role, isVerified: verified };
  return Object.keys(getTableColumns(users)).map(
    (key) => (actor as Record<string, unknown>)[key] ?? null,
  );
}
const inserts = () => state.queries.filter((q) => q.sql.startsWith("insert"));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.options = [];
});
it("copies only whitelisted metadata and detects source changes without relying solely on timestamps", () => {
  const preview = resourceCopyPreview({
    ...source,
    compatibility: { ...metadata.compatibility, privateToken: "secret" },
  } as typeof source);
  expect(preview.metadata).toEqual(metadata);
  expect(JSON.stringify(preview)).not.toContain("secret");
  expect(
    resourceCopyPreview({ ...source, description: "Changed resource description" }).reviewDigest,
  ).not.toBe(preview.reviewDigest);
  expect(resourceCopyPreview({ ...source, organizationId: "org_a" }).reviewDigest).not.toBe(
    preview.reviewDigest,
  );
});
it.each([{ price: 20 }, { status: "suspended" }])("refuses restricted sources %j", (fields) =>
  expect(() => resourceCopyPreview({ ...source, ...fields } as typeof source)).toThrow(),
);
it("creates target, database-generated receipt and two audits in one transaction", async () => {
  state.rows = [
    [],
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [],
    [user()],
    [],
    [[0]],
    [],
    [record()],
    [],
  ];
  const result = await repo.create("usr_a", sourceId, command);
  expect(result.replayed).toBe(false);
  expect(result.receipt.metadata).toEqual(metadata);
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(inserts()).toHaveLength(3);
  const target = inserts()[0];
  expect(target.sql).toContain('"products"');
  expect(target.params).toContain("unlimited");
  expect(target.params).toContain("draft");
  expect(target.params).toContain(true);
  expect(target.params).toContain("usr_a");
  const saved = inserts()[1];
  expect(saved.sql).toContain('"resource_draft_copies"');
  expect(saved.sql).toContain("default");
  expect(saved.params).not.toContain(JSON.stringify(row.snapshot));
  expect(inserts()[2].params).toContain("product.created");
  expect(inserts()[2].params).toContain("product.draft_copied");
  expect(state.queries.filter((q) => q.sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
  expect(state.queries.some((q) => /builds|payments|licenses|entitlements/.test(q.sql))).toBe(
    false,
  );
});
it("replays exact requests after source edits only while both resources remain manageable", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, status: "suspended", description: "Changed description" })],
    [["usr_a", "user"]],
    [record()],
    [product({ ...source, id: targetId, status: "published" })],
    [["usr_a", "user"]],
  ];
  expect((await repo.create("usr_a", sourceId, command)).replayed).toBe(true);
  expect(inserts()).toHaveLength(0);
});
it("refuses reused keys with changed target details before inserting anything", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "developer"]], [record()]];
  await expect(
    repo.create("usr_a", sourceId, { ...command, title: "Other title" }),
  ).rejects.toMatchObject({ code: "RESOURCE_COPY_REQUEST_CONFLICT" });
  expect(inserts()).toHaveLength(0);
});
it("refuses lost target access on replay", async () => {
  state.rows = [
    [],
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [record()],
    [product({ ...source, id: targetId, authorId: "usr_other" })],
    [["usr_a", "developer"]],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(inserts()).toHaveLength(0);
});
it("refuses lost source authority without reading existing receipts", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, authorId: "usr_other" })],
    [["usr_a", "developer"]],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries.some((q) => q.sql.includes('from "resource_draft_copies"'))).toBe(false);
});
it("uses live creation capability, not an earlier signed-in role", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "user"]], [], [user("user", false)]];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_CREATE_FORBIDDEN",
  });
  expect(inserts()).toHaveLength(0);
});
it("requires review of the current source before creation", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, description: "Changed description" })],
    [["usr_a", "developer"]],
    [],
    [user()],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_SOURCE_CHANGED",
  });
  expect(inserts()).toHaveLength(0);
});
it("counts all immutable receipts under a source-wide quota lock", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "developer"]], [], [user()], [], [[50]]];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_LIMIT",
  });
  expect(inserts()).toHaveLength(0);
});
it("keeps organization publisher identity when a delegated manager creates a copy", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, authorId: "usr_other", organizationId: "org_a" })],
    [["usr_owner"]],
    [["usr_a", "developer"]],
    [["member", ["manage_products"]]],
    [],
    [user()],
    [],
    [[0]],
    [],
    [record()],
    [],
  ];
  expect(
    (
      await repo.create("usr_a", sourceId, {
        ...command,
        reviewDigest: resourceCopyPreview({
          ...source,
          authorId: "usr_other",
          organizationId: "org_a",
        }).reviewDigest,
      })
    ).publisherId,
  ).toBe("usr_other");
  expect(inserts()[0].params).toContain("org_a");
  expect(inserts()[0].params).toContain("usr_other");
});
it("reads frozen terms while returning current target status separately", async () => {
  state.rows = [
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [record()],
    [product({ ...source, id: targetId, title: "Later edited title", status: "archived" })],
    [["usr_a", "developer"]],
  ];
  const detail = await repo.detail("usr_a", sourceId, receiptId);
  expect(detail.receipt.target.title).toBe(command.title);
  expect(detail.targetStatus).toBe("archived");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
});
it("never forwards actor identities, request keys or arbitrary snapshot extras", () => {
  const result = resourceCopyReceipt({
    ...row,
    snapshot: { ...(row.snapshot as object), privateStorageKey: "secret" },
  });
  expect(Object.keys(result)).toEqual(["id", "createdAt", "source", "target", "metadata"]);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(() => resourceCopyReceipt({ ...row, snapshot: { version: 1 } })).toThrow();
});
it("bounds history to current managed targets and stable twenty-row pages", async () => {
  state.rows = [[], [], [product()], [["usr_a", "developer"]], [[0]], []];
  const result = await repo.page("usr_a", sourceId, 9999, 30);
  expect(result.page).toBe(1);
  expect(result.pageSize).toBe(20);
  expect(result.copies).toEqual([]);
  const query = state.queries.at(-1);
  if (!query) throw new Error("Missing history query");
  expect(query.sql).toContain('inner join "products"');
  expect(query.sql).toContain("manage_products");
  expect(query.sql).toContain('order by "resource_draft_copies"."created_at" desc');
});
