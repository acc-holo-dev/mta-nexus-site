import { beforeAll, describe, expect, it } from "vitest";
import {
  buildRepository,
  entitlementRepository,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("free resource claim idempotency", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_claim_author_${suffix}`;
  const userId = `usr_claim_${suffix}`;
  const otherUserId = `usr_claim_other_${suffix}`;
  const productId = `prd_claim_${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `claim_author_${suffix}@nexus.test`,
      username: `claim_author_${suffix}`,
      displayName: "Claim Resource Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `claim_${suffix}@nexus.test`,
      username: `claim_${suffix}`,
      displayName: "Claim Test User",
      role: "user",
    });
    await userRepository.create({
      id: otherUserId,
      email: `claim_other_${suffix}@nexus.test`,
      username: `claim_other_${suffix}`,
      displayName: "Other Claim User",
      role: "user",
    });

    await productRepository.create({
      id: productId,
      title: "Free Claim Resource",
      slug: `free-claim-${suffix}`,
      description: "Resource used to prove idempotent free claims.",
      type: "script",
      status: "published",
      authorId,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: { dependencies: [] },
    });

    await buildRepository.create({
      id: `bld_claim_safe_${suffix}`,
      productId: productId,
      version: "1.0.0",
      status: "published",
      storageKey: `assets/test/claim-safe-${suffix}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 16,
      fileName: "claim-safe.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });
  });

  it("creates exactly one entitlement and one library addition under concurrent retries", async () => {
    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        entitlementRepository.claimFreeResource({
          entitlementId: `ent_claim_${index}_${suffix}`,
          userId,
          productId,
        }),
      ),
    );

    expect(attempts.filter((attempt) => attempt.alreadyClaimed === false)).toHaveLength(1);
    expect(attempts.filter((attempt) => attempt.alreadyClaimed === true)).toHaveLength(9);

    const entitlements = await entitlementRepository.listBySubject({
      type: "user",
      id: userId,
    });
    const productClaims = entitlements.filter(
      (entitlement) =>
        entitlement.resourceId === productId && entitlement.permission === "product.download",
    );

    expect(productClaims).toHaveLength(1);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: userId },
        productId,
        "product.download",
      ),
    ).toBe(true);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: otherUserId },
        productId,
        "product.download",
      ),
    ).toBe(false);

    const product = await productRepository.findById(productId);
    expect(product?.salesCount).toBe(1);
  });

  it("returns the same entitlement on a later retry without incrementing salesCount", async () => {
    const first = await entitlementRepository.claimFreeResource({
      entitlementId: `ent_late_retry_${suffix}`,
      userId,
      productId,
    });
    const product = await productRepository.findById(productId);

    expect(first.alreadyClaimed).toBe(true);
    expect(first.entitlement?.resourceId).toBe(productId);
    expect(product?.salesCount).toBe(1);
  });
});
