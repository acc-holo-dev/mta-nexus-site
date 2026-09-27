import { describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  where: null as SQL | null,
  order: [] as SQL[],
  limit: 0,
  offset: 0,
}));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where(condition: SQL) {
          captured.where = condition;
          const query = {
            orderBy(...columns: SQL[]) { captured.order = columns; return query; },
            limit(value: number) { captured.limit = value; return query; },
            offset(value: number) { captured.offset = value; return Promise.resolve([]); },
          };
          return query;
        },
      }),
    }),
  },
}));

import { ProductRepository } from "../packages/db/src/repositories/products";

const dialect = new PgDialect();

describe("catalog database pagination", () => {
  it("keeps free, scanned publication gates and a unique sort key across pages", async () => {
    await new ProductRepository().list({
      type: "script", sort: "rating", query: "100%_ MTA", limit: 25, offset: 24,
    });
    const where = dialect.sqlToQuery(captured.where!);
    expect(where.sql).toContain('"products"."status"');
    expect(where.sql).toContain('"products"."price"');
    expect(where.sql).toContain("exists (");
    expect(where.params).toContain("%100\\%\\_ MTA%");
    expect(where.params).toContain("script");
    expect(captured.order.map((sql) => dialect.sqlToQuery(sql).sql))
      .toEqual(expect.arrayContaining([
        '"products"."rating_average" desc',
        '"products"."id" desc',
      ]));
    expect(captured.limit).toBe(25);
    expect(captured.offset).toBe(24);
  });

  it("bounds even internal callers' scan range", async () => {
    await new ProductRepository().list({ limit: Number.POSITIVE_INFINITY, offset: 9_999_999 });
    expect(captured.limit).toBe(100);
    expect(captured.offset).toBe(100_000);
  });
});
