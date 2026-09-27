import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  filter: null as SQL | null,
  order: [] as SQL[],
  limit: 0,
  offset: 0,
  rows: [] as { id: string }[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where(filter: SQL) {
          captured.filter = filter;
          const query = {
            then(resolve: (rows: { total: number }[]) => void) { resolve([{ total: 307 }]); },
            orderBy(...order: SQL[]) { captured.order = order; return query; },
            limit(value: number) { captured.limit = value; return query; },
            offset(value: number) { captured.offset = value; return Promise.resolve(captured.rows); },
          };
          return query;
        },
      }),
    }),
  },
}));

import { BuildRepository } from "../packages/db/src/repositories/builds";
import { ContentRepository } from "../packages/db/src/repositories/content";

const dialect = new PgDialect();

describe("remaining moderation queues", () => {
  it("keeps old resource builds accessible after the first 100 and counts the entire queue", async () => {
    captured.rows = Array.from({ length: 31 }, (_, index) => ({ id: `build-${index}` }));
    const repo = new BuildRepository();
    expect(await repo.countPendingReview()).toBe(307);
    const result = await repo.listPendingReviewPage(5);
    expect(result.builds).toHaveLength(30);
    expect(result.hasMore).toBe(true);
    expect(dialect.sqlToQuery(captured.filter!).params).toEqual(["pending_review"]);
    expect(captured.order.map((part) => dialect.sqlToQuery(part).sql)).toEqual([
      '"builds"."created_at" asc', '"builds"."id" asc',
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
    expect(dialect.sqlToQuery(captured.filter!).params).toEqual(["draft"]);
    expect(captured.order.map((part) => dialect.sqlToQuery(part).sql)).toEqual([
      '"content"."created_at" asc', '"content"."id" asc',
    ]);
    expect(captured.offset).toBe(90);
    await expect(repo.listDraftPage(1, 101)).rejects.toThrow(RangeError);
  });
});
