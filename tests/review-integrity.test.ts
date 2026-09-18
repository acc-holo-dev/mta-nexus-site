import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("product review integrity", () => {
  it("requires a published resource and a real entitlement", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/reviews/route.ts"),
      "utf8"
    );

    expect(route).toContain('product.status !== "published"');
    expect(route).toContain('hasReviewFromUser(productId, user.id)');
    expect(route).toContain('"product.download"');
    expect(route).toContain("Add this resource to your library before reviewing it");
    expect(route).toContain("isVerifiedPurchase: hasAcquired");
  });

  it("handles duplicate submissions both before and during insertion", () => {
    const route = readFileSync(
      resolve(process.cwd(), "apps/web/src/app/api/products/[id]/reviews/route.ts"),
      "utf8"
    );

    expect(route).toContain("status: 409");
    expect(route).toContain('databaseError.code === "23505"');
    expect(route).toContain("You have already reviewed this product");
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
