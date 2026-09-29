import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { PRODUCT_TYPES, isProductType } from "@nexus/domain";
import { createProductSchema } from "@nexus/validation";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { products } from "../packages/db/src/schema";
import { parseMarketQuery } from "../apps/web/src/lib/market-query";
import { getDictionary } from "../apps/web/src/lib/i18n";
import {
  PRODUCT_CATEGORY_KEYS,
  PRODUCT_PUBLISHING_KEYS,
} from "../apps/web/src/lib/product-type-labels";

it.each(PRODUCT_TYPES)(
  "supports %s consistently across validation, catalog and translations",
  (type) => {
    expect(isProductType(type)).toBe(true);
    expect(createProductSchema.shape.type.parse(type)).toBe(type);
    expect(parseMarketQuery({ type }).type).toBe(type);
    for (const locale of ["en", "ru"] as const) {
      const dictionary = getDictionary(locale);
      expect(dictionary.market[PRODUCT_CATEGORY_KEYS[type]]).toBeTruthy();
      expect(dictionary.publishing[PRODUCT_PUBLISHING_KEYS[type]]).toBeTruthy();
    }
  },
);

it.each(["tool", "SCRIPT", "", null, ["script"], "unknown"])("rejects invalid type %j", (type) => {
  expect(isProductType(type)).toBe(false);
  expect(createProductSchema.shape.type.safeParse(type).success).toBe(false);
});

it("keeps the forward migration and schema constraint aligned with the registry", () => {
  const migration = readFileSync("packages/db/migrations/0024_product_type_invariant.sql", "utf8");
  const typeList = migration.match(/type IN \(([^)]+)\)/)?.[1];
  if (!typeList) throw new Error("Migration lacks type constraint");
  const values = [...typeList.matchAll(/'([^']+)'/g)].map(
    (match) => match[1],
  );
  expect(values).toEqual([...PRODUCT_TYPES]);
  expect(migration).toContain("WHERE type = 'tool'");
  const check = getTableConfig(products).checks.find((item) => item.name === "products_type_check");
  expect(check).toBeDefined();
  if (!check) throw new Error("Schema lacks type constraint");
  const query = new PgDialect().sqlToQuery(check.value).sql;
  for (const type of PRODUCT_TYPES) expect(query).toContain(`'${type}'`);
});
