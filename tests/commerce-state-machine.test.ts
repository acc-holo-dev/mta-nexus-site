import { beforeAll, describe, expect, it } from "vitest";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import {
  entitlementRepository,
  ledgerRepository,
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
    expect(second.entitlement.id).toBe(first.entitlement.id);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: player.id },
        freeResource.id,
        "product.download"
      )
    ).toBe(true);
  });

  it("never fabricates a completed paid checkout", async () => {
    const ledgerBefore = await ledgerRepository.listRecent(100);

    await expect(commerceService.createOrderAndCheckout()).rejects.toMatchObject({
      statusCode: 503,
      code: "PAYMENTS_NOT_CONFIGURED",
    });

    const ledgerAfter = await ledgerRepository.listRecent(100);
    expect(ledgerAfter).toHaveLength(ledgerBefore.length);
    expect(
      await entitlementRepository.hasEntitlement(
        { type: "user", id: player.id },
        paidResource.id,
        "product.download"
      )
    ).toBe(false);
  });

  it("rejects a paid resource through the free claim path", async () => {
    await expect(
      commerceService.claimFreeResource({ user: player, productId: paidResource.id })
    ).rejects.toMatchObject({ statusCode: 422 });
  });
});
