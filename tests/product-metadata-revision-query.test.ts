import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ condition: undefined as SQL | undefined,
  values: undefined as { updatedAt: SQL } | undefined, rows: [] as unknown[], audit: vi.fn() }));
vi.mock("../packages/db/src/client", () => ({ db: {
  transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
    update: () => ({ set: (values: { updatedAt: SQL }) => {
      state.values = values;
      return { where: (condition: SQL) => { state.condition = condition; return { returning: async () => state.rows }; } };
    } }),
    insert: () => ({ values: state.audit }),
  }),
} }));
import { ProductRepository } from "../packages/db/src/repositories/products";
const repository = new ProductRepository();
const dialect = new PgDialect();
const actor = { id: "author", role: "developer" as const };
const details = { title: "Title", description: "Description", shortDescription: "Summary", tags: ["lua"] };
const audit = { id: "aud_revision", actorId: actor.id, actorType: "user" as const,
  action: "product.details_updated", targetId: "resource", targetType: "product" };
beforeEach(() => { state.rows = []; state.condition = undefined; state.values = undefined; state.audit.mockReset(); });
it("compares millisecond revision atomically alongside the resource and management scope", async () => {
  const revision = new Date("2026-10-04T20:00:00.123Z");
  expect(await repository.updateManagedDetails("resource", actor, details, audit, revision)).toBeNull();
  if (!state.condition) throw new Error("Expected guarded product update condition");
  const query = dialect.sqlToQuery(state.condition);
  expect(query.sql).toContain('date_trunc(\'milliseconds\', "products"."updated_at")');
  expect(query.sql).toContain("::timestamptz");
  expect(query.sql).toContain("manage_products");
  expect(query.params).toEqual(expect.arrayContaining(["resource", 0, "author", revision.toISOString()]));
  expect(state.audit).not.toHaveBeenCalled();
  if (!state.values) throw new Error("Expected product update values");
  const update = dialect.sqlToQuery(state.values.updatedAt).sql;
  expect(update).toContain("greatest");
  expect(update).toContain("clock_timestamp()");
  expect(update).toContain("interval '1 millisecond'");
});
it("writes one audit only when the guarded update returns a row", async () => {
  state.rows = [{ id: "resource" }];
  expect(await repository.updateManagedDetails("resource", actor, details, audit)).toEqual({ id: "resource" });
  expect(state.audit).toHaveBeenCalledExactlyOnceWith(audit);
  if (!state.condition) throw new Error("Expected unversioned product update condition");
  expect(dialect.sqlToQuery(state.condition).sql).not.toContain("date_trunc");
});
