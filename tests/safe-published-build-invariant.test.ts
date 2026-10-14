import { sql } from "drizzle-orm";
import { getTableConfig, PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { safePublishedBuildCondition } from "../packages/db/src/repositories/build-safety";
import { builds, products } from "../packages/db/src/schema";

const dialect = new PgDialect();

describe("safe published build invariant", () => {
  it("binds the exact product and requires publication with trusted scan provenance", () => {
    const productId = "product' OR TRUE --";
    const query = dialect.sqlToQuery(sql`${safePublishedBuildCondition(productId)}`);
    expect(query.params).toEqual([productId, "published", "clean"]);
    expect(query.sql).not.toContain(productId);
    expect(query.sql).toContain('"builds"."product_id" = $1');
    expect(query.sql).toContain('"builds"."status" = $2');
    expect(query.sql).toContain('"builds"."scan_status" = $3');
    expect(query.sql).toContain('"builds"."scanner" is not null');
    expect(query.sql).toContain('btrim("builds"."scanner") <> \'\'');
    expect(query.sql).toContain('"builds"."scanned_at" is not null');
  });

  it("correlates a product expression without turning it into a literal value", () => {
    const query = dialect.sqlToQuery(sql`${safePublishedBuildCondition(sql`${products.id}`)}`);
    expect(query.sql).toContain('"builds"."product_id" = "products"."id"');
    expect(query.params).toEqual(["published", "clean"]);
  });

  it.each([
    ["builds_clean_scan_provenance_check", '"builds"."scan_status" <> \'clean\''],
    ["builds_published_safe_check", '"builds"."status" <> \'published\''],
  ])("attaches the %s constraint to the actual builds schema", (name, bypass) => {
    const constraint = getTableConfig(builds).checks.find((check) => check.name === name);
    if (!constraint) throw new Error(`Missing build constraint: ${name}`);
    const query = dialect.sqlToQuery(constraint.value);
    expect(query.sql).toContain(bypass);
    expect(query.sql).toContain('"builds"."scanner" IS NOT NULL');
    expect(query.sql).toContain('btrim("builds"."scanner") <> \'\'');
    expect(query.sql).toContain('"builds"."scanned_at" IS NOT NULL');
    if (name === "builds_published_safe_check")
      expect(query.sql).toContain('"builds"."scan_status" = \'clean\'');
  });
});
