import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  where: null as SQL | null,
  order: [] as SQL[],
  limit: 0,
  offset: 0,
  rows: [] as { id: string }[],
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where(condition: SQL) {
          captured.where = condition;
          const query = {
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

import { ReportRepository } from "../packages/db/src/repositories/reports";

const dialect = new PgDialect();

describe("report moderation queue", () => {
  it("reviews oldest unresolved cases first with bounded stable pages", async () => {
    captured.rows = Array.from({ length: 31 }, (_, index) => ({ id: `report-${index}` }));
    const result = await new ReportRepository().listPage("pending", 2);
    expect(result.reports).toHaveLength(30);
    expect(result.hasMore).toBe(true);
    expect(dialect.sqlToQuery(captured.where!).params).toEqual(["open", "under_review"]);
    expect(captured.order.map((column) => dialect.sqlToQuery(column).sql)).toEqual([
      '"reports"."created_at" asc', '"reports"."id" asc',
    ]);
    expect(captured.limit).toBe(31);
    expect(captured.offset).toBe(30);
  });

  it("separates final decisions and refuses unbounded scan requests", async () => {
    captured.rows = [];
    const result = await new ReportRepository().listPage("history", 1);
    expect(result.hasMore).toBe(false);
    expect(dialect.sqlToQuery(captured.where!).params).toEqual(["resolved", "dismissed"]);
    expect(captured.order.map((column) => dialect.sqlToQuery(column).sql)).toEqual([
      '"reports"."resolved_at" desc', '"reports"."id" desc',
    ]);
    await expect(new ReportRepository().listPage("pending", 0)).rejects.toThrow(RangeError);
    await expect(new ReportRepository().listPage("pending", 1, 10_000)).rejects.toThrow(RangeError);
  });
});
