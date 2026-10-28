import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  filter: null as SQL | null,
  order: [] as SQL[],
  limit: 0,
  offset: 0,
  joins: 0,
  rows: [] as { id: string }[] | Record<string, unknown>[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => {
        const query = {
          innerJoin: () => {
            captured.joins += 1;
            return query;
          },
          where(filter: SQL) {
            captured.filter = filter;
            return {
              // biome-ignore lint/suspicious/noThenProperty: The Drizzle count query mock must be awaitable.
              then(resolve: (rows: { total: number }[]) => void) {
                resolve([{ total: 307 }]);
              },
              orderBy(...order: SQL[]) {
                captured.order = order;
                const ordered = {
                  limit(value: number) {
                    captured.limit = value;
                    return ordered;
                  },
                  offset(value: number) {
                    captured.offset = value;
                    return Promise.resolve(captured.rows);
                  },
                };
                return ordered;
              },
            };
          },
        };
        return query;
      },
    }),
  },
}));

import { BuildRepository } from "../packages/db/src/repositories/builds";
import { ContentRepository } from "../packages/db/src/repositories/content";

const dialect = new PgDialect();

function filterParams() {
  if (captured.filter === null) throw new Error("Expected a moderation status filter");
  return dialect.sqlToQuery(captured.filter).params;
}

describe("remaining moderation queues", () => {
  beforeEach(() => {
    captured.filter = null;
    captured.order = [];
    captured.limit = 0;
    captured.offset = 0;
    captured.joins = 0;
    captured.rows = [];
  });

  it("keeps old resource builds accessible after the first 100 and counts the entire queue", async () => {
    captured.rows = Array.from({ length: 31 }, (_, index) => ({
      build: { id: `build-${index}` },
      productTitle: `Resource ${index}`,
      productSlug: `resource-${index}`,
      productStatus: "pending_review",
      publisherId: "user_1",
      publisherUsername: "creator",
    }));
    const repo = new BuildRepository();
    expect(await repo.countPendingReview()).toBe(307);
    const result = await repo.listPendingReviewPage(5);
    expect(result.builds).toHaveLength(30);
    expect(captured.joins).toBe(2);
    expect(result.builds[0]).toMatchObject({
      id: "build-0",
      productTitle: "Resource 0",
      publisherUsername: "creator",
    });
    expect(result.hasMore).toBe(true);
    expect(filterParams()).toEqual(["pending_review"]);
    expect(captured.order.map((part) => dialect.sqlToQuery(part).sql)).toEqual([
      '"builds"."created_at" asc',
      '"builds"."id" asc',
    ]);
    expect(captured.limit).toBe(31);
    expect(captured.offset).toBe(120);
    await expect(repo.listPendingReviewPage(0)).rejects.toThrow(RangeError);
  });

  it("keeps old community drafts accessible and bounds page size", async () => {
    captured.rows = [];
    const repo = new ContentRepository();
    expect(await repo.countDrafts()).toBe(307);
    const result = await repo.listDraftPage(4);
    expect(result.items).toEqual([]);
    expect(result.hasMore).toBe(false);
    expect(filterParams()).toEqual(["draft"]);
    expect(captured.order.map((part) => dialect.sqlToQuery(part).sql)).toEqual([
      '"content"."created_at" asc',
      '"content"."id" asc',
    ]);
    expect(captured.offset).toBe(90);
    await expect(repo.listDraftPage(1, 101)).rejects.toThrow(RangeError);
  });
});
