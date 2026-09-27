import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured = vi.hoisted(() => ({ conditions: [] as SQL[] }));

vi.mock("../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where(condition: SQL) {
          captured.conditions.push(condition);
          const query = {
            orderBy: () => query,
            then: (resolve: (rows: unknown[]) => void) => resolve([]),
          };
          return query;
        },
      }),
    }),
  },
}));

import { ProductRepository } from "../packages/db/src/repositories/products";
import { ServerRepository } from "../packages/db/src/repositories/servers";

const dialect = new PgDialect();
const queries = () => captured.conditions.map((condition) => dialect.sqlToQuery(condition));

describe("saved items and public profile selections", () => {
  beforeEach(() => { captured.conditions = []; });

  it("skips empty saved selections and chunks more than 500 IDs without catalog limits", async () => {
    const products = new ProductRepository();
    const servers = new ServerRepository();
    await products.listPublishedFreeByIds([]);
    await servers.listActivePublicByIds([]);
    expect(queries()).toHaveLength(0);

    const ids = Array.from({ length: 501 }, (_, index) => `item-${index}`);
    await products.listPublishedFreeByIds(ids);
    await servers.listActivePublicByIds(ids);
    expect(queries()).toHaveLength(4);
    expect(queries()[0]?.params).toContain("item-499");
    expect(queries()[1]?.params).toContain("item-500");
    expect(queries()[2]?.sql).toContain('"servers"."visibility"');
    expect(queries()[2]?.sql).toContain('"servers"."status"');
    expect(queries()[0]?.sql).toContain('"products"."status"');
    expect(queries()[0]?.sql).toContain('"products"."price"');
    expect(queries()[0]?.sql).toContain("exists (");
  });

  it("scopes author and owner queries while retaining public safety filters", async () => {
    await new ProductRepository().listPublishedFreeByAuthor("author-1");
    await new ServerRepository().listActivePublicByOwner("owner-1");
    expect(queries()).toHaveLength(2);
    expect(queries()[0]?.params).toContain("author-1");
    expect(queries()[0]?.sql).toContain("exists (");
    expect(queries()[1]?.params).toContain("owner-1");
    expect(queries()[1]?.params).toContain("public");
    expect(queries()[1]?.params).toContain("active");
  });
});
