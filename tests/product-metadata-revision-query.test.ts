import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  condition: undefined as SQL | undefined,
  values: undefined as { updatedAt: SQL } | undefined,
  rows: [] as unknown[],
  selects: [] as unknown[][],
  audit: vi.fn(),
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (run: (tx: unknown) => Promise<unknown>) =>
      run({
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => ({ for: async () => state.selects.shift() ?? [] }) }),
          }),
        }),
        update: () => ({
          set: (values: { updatedAt: SQL }) => {
            state.values = values;
            return {
              where: (condition: SQL) => {
                state.condition = condition;
                return { returning: async () => state.rows };
              },
            };
          },
        }),
        insert: () => ({ values: state.audit }),
      }),
  },
}));
import { ProductRepository } from "../packages/db/src/repositories/products";
const repository = new ProductRepository();
const dialect = new PgDialect();
const actor = { id: "author", role: "developer" as const };
const details = {
  title: "Title",
  description: "Description",
  shortDescription: "Summary",
  tags: ["lua"],
};
const audit = {
  id: "aud_revision",
  actorId: actor.id,
  actorType: "user" as const,
  action: "product.details_updated",
  targetId: "resource",
  targetType: "product",
};
beforeEach(() => {
  state.rows = [];
  state.condition = undefined;
  state.values = undefined;
  state.audit.mockReset();
  state.selects = [
    [{ id: "resource", authorId: "author", organizationId: null, status: "published" }],
    [{ id: "author", role: "developer" }],
  ];
});
it("compares millisecond revision atomically alongside the resource and management scope", async () => {
  const revision = new Date("2026-10-04T20:00:00.123Z");
  expect(
    await repository.updateManagedDetails("resource", actor, details, audit, revision),
  ).toBeNull();
  if (!state.condition) throw new Error("Expected guarded product update condition");
  const query = dialect.sqlToQuery(state.condition);
  expect(query.sql).toContain('date_trunc(\'milliseconds\', "products"."updated_at")');
  expect(query.sql).toContain("::timestamptz");
  expect(query.sql).toContain("manage_products");
  expect(query.params).toEqual(
    expect.arrayContaining(["resource", 0, "author", revision.toISOString()]),
  );
  expect(state.audit).not.toHaveBeenCalled();
  if (!state.values) throw new Error("Expected product update values");
  const update = dialect.sqlToQuery(state.values.updatedAt).sql;
  expect(update).toContain("greatest");
  expect(update).toContain("clock_timestamp()");
  expect(update).toContain("interval '1 millisecond'");
});
it("writes one audit only when the guarded update returns a row", async () => {
  state.rows = [{ id: "resource", status: "draft", metadataReviewRequired: true }];
  expect(await repository.updateManagedDetails("resource", actor, details, audit)).toEqual({
    id: "resource",
    status: "draft",
    metadataReviewRequired: true,
  });
  expect(state.audit).toHaveBeenCalledExactlyOnceWith({
    ...audit,
    details: { previousStatus: "published", status: "draft", metadataReviewRequired: true },
  });
  if (!state.condition) throw new Error("Expected unversioned product update condition");
  expect(dialect.sqlToQuery(state.condition).sql).not.toContain("date_trunc");
});
it("denies a removed organization manager before changing metadata or writing audit", async () => {
  state.selects = [
    [{ id: "resource", authorId: "other", organizationId: "org_a" }],
    [{ ownerId: "owner" }],
    [{ id: "author", role: "developer" }],
    [{ role: "member", permissions: [] }],
  ];
  await expect(
    repository.updateManagedDetails("resource", actor, details, audit),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.values).toBeUndefined();
  expect(state.audit).not.toHaveBeenCalled();
});
it("does not trust a stale administrator role from a service preflight", async () => {
  state.selects = [
    [{ id: "resource", authorId: "other", organizationId: null }],
    [{ id: "author", role: "user" }],
  ];
  await expect(
    repository.updateManagedDetails("resource", { ...actor, role: "admin" }, details, audit),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(state.values).toBeUndefined();
  expect(state.audit).not.toHaveBeenCalled();
});

it.each(["archived", "suspended"])("refuses metadata writes for %s resources", async (status) => {
  state.selects = [
    [{ id: "resource", authorId: "author", organizationId: null, status }],
    [{ id: "author", role: "developer" }],
  ];
  await expect(
    repository.updateManagedDetails("resource", actor, details, audit),
  ).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
  expect(state.values).toBeUndefined();
  expect(state.audit).not.toHaveBeenCalled();
});
