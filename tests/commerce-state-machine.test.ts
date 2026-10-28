import { beforeAll, describe, expect, it } from "vitest";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import {
  buildRepository,
  entitlementRepository,
  productRepository,
  userRepository,
} from "@nexus/db";
import type { Product, User } from "@nexus/domain";

describe("safe resource acquisition", () => {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  let player: User;
  let author: User;
  let freeResource: Product;
  let paidResource: Product;

  beforeAll(async () => {
    player = await userRepository.create({
      id: `usr_claim_player_${suffix}`,
      email: `claim_player_${suffix}@nexus.test`,
      username: `claim_player_${suffix}`,
      displayName: "Claim Player",
      role: "user",
    });
    author = await userRepository.create({
      id: `usr_claim_author_${suffix}`,
      email: `claim_author_${suffix}@nexus.test`,
      username: `claim_author_${suffix}`,
      displayName: "Claim Author",
      role: "developer",
    });

    const base = {
      description: "A resource used to verify acquisition safety",
      type: "script" as const,
      status: "published" as const,
      authorId: author.id,
      currency: "USD",
      licenseModel: "unlimited" as const,
      tags: ["test"],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    };

    freeResource = await productRepository.create({
      ...base,
      id: `prd_free_${suffix}`,
      title: "Free Test Resource",
      slug: `free-test-resource-${suffix}`,
      price: 0,
    });
    paidResource = await productRepository.create({
      ...base,
      id: `prd_paid_${suffix}`,
      title: "Paid Test Resource",
      slug: `paid-test-resource-${suffix}`,
      price: 2500,
    });

    await buildRepository.create({
      id: `bld_free_${suffix}`,
      productId: freeResource.id,
      version: "1.0.0",
      status: "published",
      storageKey: `assets/test/free-${suffix}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 16,
      fileName: "free-resource.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });
  });

  it("claims a free resource idempotently", async () => {
    const first = await commerceService.claimFreeResource({
      user: player,
      productId: freeResource.id,
    });
    const second = await commerceService.claimFreeResource({
      user: player,
      productId: freeResource.id,
    });

    expect(first.alreadyClaimed).toBe(false);
    expect(second.alreadyClaimed).toBe(true);
    expect(first.entitlement?.id).toBeTruthy();
    expect(second.entitlement?.id).toBe(first.entitlement?.id);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: player.id },
        freeResource.id,
        "product.download",
      ),
    ).toBe(true);
  });

  it("does not expose a paid checkout primitive in the closed-beta runtime", async () => {
    expect("createOrderAndCheckout" in commerceService).toBe(false);
    expect("verifyLicense" in commerceService).toBe(false);
    expect("getUserLicenses" in commerceService).toBe(false);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: player.id },
        paidResource.id,
        "product.download",
      ),
    ).toBe(false);
  });

  it("rejects a paid resource through the free claim path", async () => {
    await expect(
      commerceService.claimFreeResource({ user: player, productId: paidResource.id }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
