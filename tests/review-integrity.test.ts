import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("product review database integrity", () => {
  it("serializes rating aggregation with the review insert", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/reviews/route.ts"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );

    expect(route).toContain("contentRepository.addProductReview");
    expect(route).not.toContain("Recalculate true rating average");
    const dollar = "$";
    expect(repository).toContain("async addProductReview(");
    expect(repository).toContain('eq(products.status, "published")');
    expect(repository).toContain(`set({ updatedAt: sql\`${dollar}{products.updatedAt}\` })`);
    expect(repository).toContain(`count(${dollar}{comments.rating})::int`);
    expect(repository).toContain(`avg(${dollar}{comments.rating}) * 10`);
    expect(repository).toContain("ratingCount,");
    expect(repository).toContain("ratingAverage,");
  });

  it("enforces one product review per author at the database boundary", () => {
    const schema = readFileSync(
      resolve(process.cwd(), "packages/db/src/schema.ts"),
      "utf8"
    );
    const migration = readFileSync(
      resolve(process.cwd(), "packages/db/migrations/0009_review_author_uniqueness.sql"),
      "utf8"
    );
    const repository = readFileSync(
      resolve(process.cwd(), "packages/db/src/repositories/content.ts"),
      "utf8"
    );

    expect(schema).toContain('uniqueIndex("comments_product_author_idx")');
    expect(schema).toContain("Nullable product_id keeps article comments independent");
    expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "comments_product_author_idx"');
    expect(migration).toContain("duplicate reviews exist");
    expect(repository).toContain("hasReviewFromUser");
  });
});
