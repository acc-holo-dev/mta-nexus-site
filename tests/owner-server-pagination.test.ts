import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  total: 25,
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
import { ServerRepository } from "../packages/db/src/repositories/servers";
const repository = new ServerRepository();
const dialect = new PgDialect();
beforeEach(() => {
  state.total = 25;
  state.limit = 0;
  state.offset = 0;
  state.conditions = [];
  state.order = [];
});

it("uses identical owner/public/active conditions for the total and page", async () => {
  const result = await repository.pageActivePublicByOwner("owner", 2, 12);
  expect(result).toMatchObject({ total: 25, page: 2, pageSize: 12, totalPages: 3 });
  expect(state.limit).toBe(12);
  expect(state.offset).toBe(12);
  const queries = state.conditions.map((condition) => dialect.sqlToQuery(condition));
  expect(queries[0]).toEqual(queries[1]);
  expect(queries[0].params).toEqual(expect.arrayContaining(["owner", "public", "active"]));
  expect(queries[0].sql).toContain('"servers"."visibility"');
  expect(queries[0].sql).toContain('"servers"."status"');
  expect(state.order.map((order) => dialect.sqlToQuery(order).sql)).toEqual([
    '"servers"."updated_at" desc',
    '"servers"."id" desc',
  ]);
});

it("clamps stale page links to the final available page", async () => {
  expect(await repository.pageActivePublicByOwner("owner", 999999, 12)).toMatchObject({
    page: 3,
    totalPages: 3,
  });
  expect(state.offset).toBe(24);
});

it("keeps empty portfolios on page one", async () => {
  state.total = 0;
  expect(await repository.pageActivePublicByOwner("owner", 5)).toMatchObject({
    total: 0,
    page: 1,
    totalPages: 1,
  });
  expect(state.offset).toBe(0);
});

it.each([
  [NaN, NaN, 12],
  [-2, -10, 1],
  [Infinity, 1000, 100],
])("bounds page %s and page size %s", async (page, size, expectedSize) => {
  expect(await repository.pageActivePublicByOwner("owner", page, size)).toMatchObject({
    page: 1,
    pageSize: expectedSize,
  });
  expect(state.offset).toBe(0);
});
