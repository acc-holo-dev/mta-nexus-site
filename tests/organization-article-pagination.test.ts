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
import { ContentRepository } from "../packages/db/src/repositories/content";
const repository = new ContentRepository();
const dialect = new PgDialect();
beforeEach(() => {
  state.total = 49;
  state.limit = 0;
  state.offset = 0;
  state.conditions = [];
  state.order = [];
});

it("uses identical organization/public/editorial conditions for the total and page", async () => {
  const result = await repository.pagePublishedEditorialByOrganization("organization", 2, 24);
  expect(result).toMatchObject({ total: 49, page: 2, pageSize: 24, totalPages: 3 });
  expect(state.limit).toBe(24);
  expect(state.offset).toBe(24);
  const queries = state.conditions.map((condition) => dialect.sqlToQuery(condition));
  expect(queries[0]).toEqual(queries[1]);
  expect(queries[0].params).toEqual(expect.arrayContaining(["organization", "published", "article", "news", "devlog", "update", "announcement"]));
  expect(queries[0].sql).toContain('"content"."organization_id"');
  expect(queries[0].sql).toContain('"content"."type" in');
  expect(state.order.map((order) => dialect.sqlToQuery(order).sql)).toEqual([
    'coalesce("content"."published_at", "content"."updated_at") desc',
    '"content"."id" desc',
  ]);
});

it("clamps stale page links to the final available page", async () => {
  expect(await repository.pagePublishedEditorialByOrganization("organization", 999999, 24)).toMatchObject({
    page: 3,
    totalPages: 3,
  });
  expect(state.offset).toBe(48);
});

it("keeps empty portfolios on page one", async () => {
  state.total = 0;
  expect(await repository.pagePublishedEditorialByOrganization("organization", 5)).toMatchObject({
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
  expect(await repository.pagePublishedEditorialByOrganization("organization", page, size)).toMatchObject({
    page: 1,
    pageSize: expectedSize,
  });
  expect(state.offset).toBe(0);
});

