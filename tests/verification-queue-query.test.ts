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

import { VerificationRepository } from "../packages/db/src/repositories/verification";

const dialect = new PgDialect();

describe("verification queue query", () => {
  it("does not lose old pending applications behind completed decisions", async () => {
    captured.rows = Array.from({ length: 31 }, (_, index) => ({ id: `ver-${index}` }));
    const result = await new VerificationRepository().listPage("pending", 4);
    expect(result.requests).toHaveLength(30);
    expect(result.hasMore).toBe(true);
    if (!captured.where) throw new Error("Expected pending queue filter to be captured");
    expect(dialect.sqlToQuery(captured.where).params).toEqual(["pending"]);
    expect(captured.order.map((column) => dialect.sqlToQuery(column).sql)).toEqual([
      '"verification_requests"."created_at" asc',
      '"verification_requests"."id" asc',
    ]);
    expect(captured.limit).toBe(31);
    expect(captured.offset).toBe(90);
  });

  it("separates final decisions and rejects excessive scan ranges", async () => {
    captured.rows = [];
    const result = await new VerificationRepository().listPage("history", 1);
    expect(result.hasMore).toBe(false);
    if (!captured.where) throw new Error("Expected history queue filter to be captured");
    expect(dialect.sqlToQuery(captured.where).params).toEqual(["approved", "rejected"]);
    expect(captured.order.map((column) => dialect.sqlToQuery(column).sql)).toEqual([
      '"verification_requests"."resolved_at" desc',
      '"verification_requests"."id" desc',
    ]);
    await expect(new VerificationRepository().listPage("pending", 0)).rejects.toThrow(RangeError);
    await expect(new VerificationRepository().listPage("pending", 1, 101)).rejects.toThrow(RangeError);
  });
});
