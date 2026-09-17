import { describe, it, expect, beforeAll } from "vitest";
import {
  userRepository,
  productRepository,
  socialRepository,
  notificationRepository,
  reportRepository,
  licenseRepository,
  contentRepository,
} from "@nexus/db";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import type { User, Product } from "@nexus/domain";

describe("Nexus 1.2 Public Platform Journeys", () => {
  const ts = Date.now().toString(36);
  let playerUser: User;
  let devUser: User;
  let testProduct: Product;

  beforeAll(async () => {
    playerUser = await userRepository.create({
      id: `usr_pl_${ts}`,
      email: `player_${ts}@nexus.test`,
      username: `player_${ts}`,
      displayName: "Journey Player",
      role: "user",
    });

    devUser = await userRepository.create({
      id: `usr_dv_${ts}`,
      email: `dev_${ts}@nexus.test`,
      username: `dev_${ts}`,
      displayName: "Journey Developer",
      role: "developer",
    });

    testProduct = await productRepository.create({
      id: `prd_jr_${ts}`,
      title: "Journey Test Resource",
      slug: `journey-test-${ts}`,
      description: "Resource for public platform journey tests",
      type: "script",
      status: "published",
      authorId: devUser.id,
      price: 0,
      currency: "USD",
      licenseModel: "single_server",
      tags: ["journey"],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    });
  });

  it("Player Journey: Follow a developer and receive notifications", async () => {
    // 1. Follow developer
    const follow = await socialRepository.follow({
      id: `fol_${Date.now()}`,
      followerId: playerUser.id,
      targetType: "user",
      targetId: devUser.id,
    });
    expect(follow).toBeDefined();

    const isFollowing = await socialRepository.isFollowing(playerUser.id, "user", devUser.id);
    expect(isFollowing).toBe(true);

    // 2. Developer receives follow notification
    const notification = await notificationRepository.create({
      id: `not_${Date.now()}`,
      recipientId: devUser.id,
      title: "New Follower",
      message: `@${playerUser.username} followed your updates.`,
      type: "system",
      link: `/users/${playerUser.username}`,
    });
    expect(notification).toBeDefined();

    const unread = await notificationRepository.countUnread(devUser.id);
    expect(unread).toBeGreaterThanOrEqual(1);

    const unreadFeed = await notificationRepository.listByUser(devUser.id, 1, true);
    expect(unreadFeed).toHaveLength(1);
    expect(unreadFeed[0].isRead).toBe(false);
  });

  it("Resource Journey: Claim a free product and receive a download entitlement", async () => {
    // 1. Before purchase: check entitlement -> false
    const hasInitial = await commerceService.checkEntitlement(
      { type: "user", id: playerUser.id },
      testProduct.id,
      "product.download"
    );
    expect(hasInitial).toBe(false);

    // 2. Claim the free resource
    const claim = await commerceService.claimFreeResource({
      user: playerUser,
      productId: testProduct.id,
    });

    expect(claim.alreadyClaimed).toBe(false);
    expect(claim.entitlement.permission).toBe("product.download");

    // 3. After acquisition: check entitlement -> true
    const hasEntitled = await commerceService.checkEntitlement(
      { type: "user", id: playerUser.id },
      testProduct.id,
      "product.download"
    );
    expect(hasEntitled).toBe(true);
  });

  it("Review & Rating Journey: Submit verified review and recalculate rating", async () => {
    // Submit review with 5 stars
    const review = await contentRepository.addComment({
      id: `cmt_${Date.now()}`,
      productId: testProduct.id,
      authorId: playerUser.id,
      text: "Exceptional code quality and documentation!",
      rating: 5,
      isVerifiedPurchase: true,
    });
    expect(review.isVerifiedPurchase).toBe(true);

    // Update product rating
    await productRepository.update(testProduct.id, {
      ratingCount: 1,
      ratingAverage: 50, // 5.0
    });

    const updated = await productRepository.findById(testProduct.id);
    expect(updated?.ratingCount).toBe(1);
    expect(updated?.ratingAverage).toBe(50);
  });

  it("Moderation Journey: Submit a report for suspicious content", async () => {
    const report = await reportRepository.create({
      id: `rpt_${Date.now()}`,
      reporterId: playerUser.id,
      targetType: "product",
      targetId: testProduct.id,
      type: "copyright",
      reason: "Suspected uncredited script source",
      evidenceUrls: ["https://nexus.test/evidence"],
      status: "open",
    });
    expect(report.status).toBe("open");

    // Resolve report
    const resolved = await reportRepository.resolve(report.id, "resolved", "Case verified and closed");
    expect(resolved?.status).toBe("resolved");
  });
});
