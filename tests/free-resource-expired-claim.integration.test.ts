import { beforeAll, describe, expect, it } from "vitest";
import {
  buildRepository,
  entitlementRepository,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("expired free resource claims", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_expired_author_${suffix}`;
  const userId = `usr_expired_claim_${suffix}`;
  const productId = `prd_expired_claim_${suffix}`;
  const expiredEntitlementId = `ent_expired_${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `expired_author_${suffix}@nexus.test`,
      username: `expired_author_${suffix}`,
      displayName: "Expired Claim Author",
      role: "developer",
    });
    await userRepository.create({
      id: userId,
      email: `expired_claim_${suffix}@nexus.test`,
      username: `expired_claim_${suffix}`,
      displayName: "Expired Claim User",
      role: "user",
    });
    await productRepository.create({
      id: productId,
      title: "Expired Claim Resource",
      slug: `expired-claim-${suffix}`,
      description: "Resource used to prove expired claim renewal.",
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
    await entitlementRepository.create({
      id: expiredEntitlementId,
      subjectType: "user",
      subjectId: userId,
      permission: "product.download",
      resourceId: productId,
      expiresAt: new Date(Date.now() - 60_000),
    });
  });

  it("serializes concurrent renewal of an expired claim and keeps later retries idempotent", async () => {
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: userId },
        productId,
        "product.download",
      ),
    ).toBe(false);

    const attempts = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        entitlementRepository.claimFreeResource({
          entitlementId: `ent_renewed_${index}_${suffix}`,
          userId,
          productId,
        }),
      ),
    );

    const created = attempts.filter(
      (attempt) => attempt.alreadyClaimed === false,
    );
    const reused = attempts.filter(
      (attempt) => attempt.alreadyClaimed === true,
    );

    expect(created).toHaveLength(1);
    expect(reused).toHaveLength(9);

    const renewedEntitlementId = created[0]?.entitlement.id;
    expect(renewedEntitlementId).toBeTruthy();
    expect(
      attempts.every(
        (attempt) => attempt.entitlement.id === renewedEntitlementId,
      ),
    ).toBe(true);
    expect(created[0]?.entitlement.expiresAt).toBeFalsy();

    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: userId },
        productId,
        "product.download",
      ),
    ).toBe(true);

    const activeRows = await entitlementRepository.listBySubject({
      type: "user",
      id: userId,
    });
    const activeClaims = activeRows.filter(
      (row) =>
        row.resourceId === productId &&
        row.permission === "product.download",
    );
    expect(activeClaims).toHaveLength(1);
    expect(activeClaims[0]?.id).toBe(renewedEntitlementId);
    expect(activeRows.some((row) => row.id === expiredEntitlementId)).toBe(
      false,
    );

    const afterRenewal = await productRepository.findById(productId);
    expect(afterRenewal?.salesCount).toBe(1);

    const retry = await entitlementRepository.claimFreeResource({
      entitlementId: `ent_late_retry_${suffix}`,
      userId,
      productId,
    });
    expect(retry.alreadyClaimed).toBe(true);
    expect(retry.entitlement.id).toBe(renewedEntitlementId);

    const afterRetry = await productRepository.findById(productId);
    expect(afterRetry?.salesCount).toBe(1);
  });
});
