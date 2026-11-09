import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  contentRepository,
  builds,
  entitlements,
  comments,
  db,
  productRepository,
  products,
  userRepository,
} from "@nexus/db";

function databaseErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as {
    code?: unknown;
    cause?: { code?: unknown };
  };
  if (typeof record.code === "string") return record.code;
  return typeof record.cause?.code === "string" ? record.cause.code : undefined;
}

describe("product review repository integration", () => {
  it("serializes concurrent review aggregation and enforces one review per author", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}_${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    const ownerId = `usr_review_owner_${suffix}`;
    const reviewerA = `usr_review_a_${suffix}`;
    const reviewerB = `usr_review_b_${suffix}`;
    const reviewerC = `usr_review_c_${suffix}`;
    const productId = `prd_review_${suffix}`;

    for (const [id, role] of [
      [ownerId, "developer"],
      [reviewerA, "user"],
      [reviewerB, "user"],
      [reviewerC, "user"],
    ] as const) {
      await userRepository.create({
        id,
        email: `${id}@nexus.test`,
        username: id,
        displayName: id,
        role,
      });
    }

    await productRepository.create({
      id: productId,
      title: "Review integration resource",
      slug: `review-integration-${suffix}`,
      description: "Review aggregation integration fixture.",
      type: "script",
      authorId: ownerId,
      status: "published",
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      compatibility: {},
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
    });

    await db.insert(builds).values({
      id: `bld_review_${suffix}`,
      productId,
      version: "1.0.0",
      status: "published",
      storageKey: "fixtures/review.zip",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 100,
      scanStatus: "clean",
      scanner: "integration-fixture",
      scannedAt: new Date(),
    });
    await db.insert(entitlements).values(
      [reviewerA, reviewerB, reviewerC].map((subjectId, i) => ({
        id: `ent_review_${i}_${suffix}`,
        subjectType: "user",
        subjectId,
        permission: "product.download",
        resourceId: productId,
      })),
    );

    const [first, second] = await Promise.all([
      contentRepository.addProductReview({
        id: `cmt_review_a_${suffix}`,
        productId,
        authorId: reviewerA,
        text: "Excellent resource",
        rating: 5,
        isVerifiedPurchase: true,
      }),
      contentRepository.addProductReview({
        id: `cmt_review_b_${suffix}`,
        productId,
        authorId: reviewerB,
        text: "Solid resource",
        rating: 3,
        isVerifiedPurchase: true,
      }),
    ]);

    expect([first.ratingCount, second.ratingCount].sort((a, b) => a - b)).toEqual([1, 2]);

    const [aggregate] = await db
      .select({
        ratingCount: products.ratingCount,
        ratingAverage: products.ratingAverage,
      })
      .from(products)
      .where(eq(products.id, productId));

    expect(aggregate).toEqual({
      ratingCount: 2,
      ratingAverage: 40,
    });
    await expect(contentRepository.hasReviewFromUser(productId, reviewerA)).resolves.toBe(true);
    await expect(contentRepository.hasReviewFromUser(productId, reviewerC)).resolves.toBe(false);

    let duplicateError: unknown;
    try {
      await contentRepository.addProductReview({
        id: `cmt_review_duplicate_${suffix}`,
        productId,
        authorId: reviewerA,
        text: "Duplicate attempt",
        rating: 1,
        isVerifiedPurchase: true,
      });
    } catch (error) {
      duplicateError = error;
    }
    expect(duplicateError).toMatchObject({ code: "REVIEW_CHANGED", statusCode: 409 });
    // The unique database constraint also protects callers outside the repository.
    try {
      await db.insert(comments).values({
        id: `cmt_raw_duplicate_${suffix}`,
        productId,
        authorId: reviewerA,
        text: "Raw duplicate",
        rating: 1,
      });
      throw new Error("Duplicate was accepted");
    } catch (error) {
      expect(databaseErrorCode(error)).toBe("23505");
    }

    const [afterDuplicate] = await db
      .select({
        ratingCount: products.ratingCount,
        ratingAverage: products.ratingAverage,
      })
      .from(products)
      .where(eq(products.id, productId));
    expect(afterDuplicate).toEqual({
      ratingCount: 2,
      ratingAverage: 40,
    });

    await db.update(products).set({ status: "draft" }).where(eq(products.id, productId));

    await expect(
      contentRepository.addProductReview({
        id: `cmt_review_draft_${suffix}`,
        productId,
        authorId: reviewerC,
        text: "Must not reach storage",
        rating: 4,
        isVerifiedPurchase: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    await expect(contentRepository.hasReviewFromUser(productId, reviewerC)).resolves.toBe(false);
  });
});
