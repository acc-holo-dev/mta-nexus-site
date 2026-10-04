import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  total: 49,
  limit: 0,
  offset: 0,
  conditions: [] as SQL[],
  order: [] as SQL[],
}));
vi.mock("../packages/db/src/client", () => ({
  db: {
    select: (selection?: unknown) => ({
      from: () => ({
        where: (condition: SQL) => {
          state.conditions.push(condition);
          if (selection) return Promise.resolve([{ total: state.total }]);
          return {
            orderBy: (...order: SQL[]) => {
              state.order = order;
              return {
                limit: (limit: number) => {
                  state.limit = limit;
                  return {
                    offset: async (offset: number) => {
                      state.offset = offset;
                      return [{ id: "resource" }];
                    },
                  };
                },
              };
            },
          };
        },
      }),
    }),
  },
}));
import { ProductRepository } from "../packages/db/src/repositories/products";
const repository = new ProductRepository();
const dialect = new PgDialect();
beforeEach(() => {
  state.total = 49;
  state.limit = 0;
  state.offset = 0;
  state.conditions = [];
  state.order = [];
});

it("scopes the total and rows to manageable free resources before pagination", async () => {
  const result = await repository.pageManaged(
    { id: "author", role: "developer" },
    "pending_review",
    2,
  );
  expect(result).toMatchObject({ total: 49, page: 2, totalPages: 3 });
  expect(state.limit).toBe(24);
  expect(state.offset).toBe(24);
  const queries = state.conditions.map((condition) => dialect.sqlToQuery(condition));
  expect(queries[0]).toEqual(queries[1]);
  expect(queries[0].params).toEqual(expect.arrayContaining(["author", "pending_review", 0]));
  expect(queries[0].sql).toContain('"products"."organization_id" is null');
  expect(queries[0].sql).toContain('"organizations"."owner_id"');
  expect(queries[0].sql).toContain('"organization_members"."user_id"');
  expect(queries[0].sql).toContain("manage_products");
  expect(queries[0].sql).not.toContain('"builds"');
});
it("gives administrators the same override as the existing policy", async () => {
  await repository.pageManaged({ id: "admin", role: "admin" });
  const query = dialect.sqlToQuery(state.conditions[0]);
  expect(query.params).toEqual([0]);
  expect(query.sql).not.toContain("manage_products");
});
it.each([NaN, Infinity, -1, 999999])("bounds requested page %s", async (page) => {
  const result = await repository.pageManaged({ id: "author", role: "developer" }, undefined, page);
  expect(result.page).toBe(page === 999999 ? 3 : 1);
});
