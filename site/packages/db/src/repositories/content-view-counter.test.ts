import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({
  updateValues: null as Record<string, unknown> | null,
  updateWhere: null as SQL | null,
  updates: 0,
}));

vi.mock("../client", () => ({
  db: {
    select() {
      const query = {
        from: () => query,
        where: () => query,
        limit: async () => [{ id: "cnt_1", viewCount: 41 }],
      };
      return query;
    },
    update() {
      captured.updates += 1;
      const query = {
        set(values: Record<string, unknown>) {
          captured.updateValues = values;
          return query;
        },
        where(condition: SQL) {
          captured.updateWhere = condition;
          return query;
        },
        returning: async () => [{ viewCount: 99 }],
      };
      return query;
    },
  },
}));

import { ContentRepository } from "./content";

const repository = new ContentRepository();
const dialect = new PgDialect();

beforeEach(() => {
  captured.updateValues = null;
  captured.updateWhere = null;
  captured.updates = 0;
});

describe("article view counter", () => {
  it("increments in SQL and returns the database value", async () => {
    const result = await repository.findPublishedBySlug("article");

    expect(result?.viewCount).toBe(99);
    expect(captured.updates).toBe(1);
    const increment = dialect.sqlToQuery(captured.updateValues?.viewCount as SQL);
    expect(increment.sql).toContain('"content"."view_count" + 1');
    expect(increment.params).toEqual([]);
    expect(dialect.sqlToQuery(captured.updateWhere as SQL).params).toEqual(["cnt_1"]);
  });

  it("does not update the counter for metadata reads", async () => {
    const result = await repository.findPublishedBySlug("article", {
      incrementView: false,
    });

    expect(result?.viewCount).toBe(41);
    expect(captured.updates).toBe(0);
  });
});
