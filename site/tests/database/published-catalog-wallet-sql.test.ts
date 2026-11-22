import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";

const captured = vi.hoisted(() => ({
  where: null as SQL | null,
}));

vi.mock("../../packages/db/src/client", () => ({
  db: {
    select: () => ({
      from: () => ({
        where(condition: SQL) {
          captured.where = condition;
          const query = {
            orderBy() {
              return query;
            },
            limit() {
              return query;
            },
            offset() {
              return Promise.resolve([]);
            },
            // biome-ignore lint/suspicious/noThenProperty: drizzle builders are awaitable thenables in these unit mocks
            then(resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) {
              return Promise.resolve([]).then(resolve, reject);
            },
          };
          return query;
        },
      }),
    }),
  },
}));

import {
  ProductRepository,
  publishedCatalogPriceCondition,
} from "../../packages/db/src/repositories/products";

const dialect = new PgDialect();

describe("published catalog wallet SQL", () => {
  it("keeps free-only price SQL when the wallet catalog flag is off", () => {
    const free = dialect.sqlToQuery(publishedCatalogPriceCondition(false));
    expect(free.sql).toContain('"products"."price"');
    expect(free.params).toContain(0);
    expect(free.sql).not.toContain("license_model");
  });

  it("includes paid single_server lines when the wallet catalog flag is on", () => {
    const wallet = dialect.sqlToQuery(publishedCatalogPriceCondition(true));
    expect(wallet.sql).toContain('"products"."price"');
    expect(wallet.sql).toContain('"products"."license_model"');
    expect(wallet.params).toEqual(expect.arrayContaining([0, "single_server"]));
  });

  it("applies the wallet catalog gate to countPublishedFree", async () => {
    captured.where = null;
    await new ProductRepository().countPublishedFree({ includeWalletPaidSingleServer: true });
    if (!captured.where) throw new Error("Expected count filter to be captured");
    const where = dialect.sqlToQuery(captured.where);
    expect(where.sql).toContain('"products"."status"');
    expect(where.sql).toContain('"products"."license_model"');
    expect(where.params).toEqual(expect.arrayContaining(["published", "single_server"]));
  });

  it("applies the wallet catalog gate to listPublishedFreeByAuthor", async () => {
    captured.where = null;
    await new ProductRepository().listPublishedFreeByAuthor("author-wallet", {
      includeWalletPaidSingleServer: true,
    });
    if (!captured.where) throw new Error("Expected author filter to be captured");
    const where = dialect.sqlToQuery(captured.where);
    expect(where.sql).toContain('"products"."author_id"');
    expect(where.sql).toContain('"products"."license_model"');
    expect(where.params).toEqual(expect.arrayContaining(["author-wallet", "single_server"]));
  });
});
