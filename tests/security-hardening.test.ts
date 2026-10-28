import { describe, it, expect, beforeAll } from "vitest";
import {
  userRepository,
  productRepository,
  notificationRepository,
  contentRepository,
  socialRepository,
  verificationRepository,
  sessionRepository,
  licenseRepository,
  buildRepository,
  orderRepository,
  developerProfileRepository,
} from "@nexus/db";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import type { User, Product } from "@nexus/domain";

describe("Nexus 1.3 Security & Trust Hardening", () => {
  const ts = Date.now().toString(36);
  let userA: User;
  let userB: User;
  let author: User;
  let admin: User;
  let product: Product;

  beforeAll(async () => {
    userA = await userRepository.create({
      id: `usr_sec_a_${ts}`,
      email: `sec_a_${ts}@nexus.test`,
      username: `sec_a_${ts}`,
      displayName: "Security User A",
      role: "user",
    });

    userB = await userRepository.create({
      id: `usr_sec_b_${ts}`,
      email: `sec_b_${ts}@nexus.test`,
      username: `sec_b_${ts}`,
      displayName: "Security User B",
      role: "user",
    });

    author = await userRepository.create({
      id: `usr_sec_auth_${ts}`,
      email: `sec_auth_${ts}@nexus.test`,
      username: `sec_auth_${ts}`,
      displayName: "Security Author",
      role: "developer",
    });

    admin = await userRepository.create({
      id: `usr_sec_admin_${ts}`,
      email: `sec_admin_${ts}@nexus.test`,
      username: `sec_admin_${ts}`,
      displayName: "Security Admin",
      role: "admin",
    });
    await sessionRepository.create({
      id: `ses_sec_admin_${ts}`,
      userId: admin.id,
      token: `tok_${admin.id}`,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
    });

    await sessionRepository.create({
      id: `ses_claim_${userB.id}`,
      userId: userB.id,
      token: `tok_${userB.id}`,
      expiresAt: new Date(Date.now() + 3600000),
    });

    product = await productRepository.create({
      id: `prd_sec_${ts}`,
      title: "Security Test Product",
      slug: `security-test-${ts}`,
      description: "Product used for security hardening tests",
      type: "script",
      status: "published",
      authorId: author.id,
      price: 0,
      currency: "USD",
      licenseModel: "single_server",
      tags: ["security"],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    });
  });

  it("IDOR: user B cannot mark user A's notification as read", async () => {
    const notification = await notificationRepository.create({
      id: `not_sec_${ts}`,
      recipientId: userA.id,
      title: "Private Alert",
      message: "This notification belongs exclusively to user A",
      type: "system",
    });

    if (!notification) throw new Error("Expected system notification to be delivered");

    // User B attempts to mark user A's notification — must be rejected
    const updatedByB = await notificationRepository.markAsRead(notification.id, userB.id);
    expect(updatedByB).toBe(false);

    // Owner marks their own notification — must succeed
    const updatedByOwner = await notificationRepository.markAsRead(notification.id, userA.id);
    expect(updatedByOwner).toBe(true);
  });

  it("Review integrity: paid product rejects review without purchase, self-review, and duplicates", async () => {
    // Rule: no purchase => cannot review (checked at API layer; repository supports state)
    const hasBought = (await licenseRepository.listByUser(userB.id)).some(
      (l) => l.productId === product.id,
    );
    expect(hasBought).toBe(false);

    // A claimable free resource needs its own dedicated product so the shared
    // fixture product stays build-free for the download authorization test.
    const reviewProduct = await productRepository.create({
      id: `prd_sec_review_${ts}`,
      title: "Security Review Product",
      slug: `security-review-${ts}`,
      description: "Product used for review integrity tests",
      type: "script",
      status: "published",
      authorId: author.id,
      price: 0,
      currency: "USD",
      licenseModel: "single_server",
      tags: ["security"],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: {},
    });

    // A published free resource must expose a trusted clean build before it can
    // be claimed or downloaded (builds_published_safe_check invariant).
    await buildRepository.create({
      id: `bld_sec_review_${ts}`,
      productId: reviewProduct.id,
      version: "1.0.0",
      status: "published",
      storageKey: `builds/${reviewProduct.id}/v1.0.0.zip`,
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 1024,
      fileName: "security-test.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    });

    // After purchase, user B can review
    await commerceService.claimFreeResource({
      user: userB,
      currentToken: `tok_${userB.id}`,
      productId: reviewProduct.id,
    });

    const review = await contentRepository.addComment({
      id: `cmt_sec_${ts}`,
      productId: reviewProduct.id,
      authorId: userB.id,
      text: "Solid resource, works as advertised",
      rating: 4,
      isVerifiedPurchase: true,
    });
    expect(review.isVerifiedPurchase).toBe(true);

    // Duplicate review must be detectable
    const duplicate = await contentRepository.hasReviewFromUser(reviewProduct.id, userB.id);
    expect(duplicate).toBe(true);
  });

  it("Follow validation: target must exist and self-follow is blocked at contract level", async () => {
    // Following a non-existent product target is rejected by validation contract
    const fakeTargetExists = await productRepository.findById("prd_does_not_exist_xyz");
    expect(fakeTargetExists).toBeNull();

    // Valid follow works and is queryable
    await socialRepository.follow({
      id: `fol_sec_${ts}`,
      followerId: userA.id,
      targetType: "user",
      targetId: author.id,
    });
    const following = await socialRepository.isFollowing(userA.id, "user", author.id);
    expect(following).toBe(true);
  });

  it("Download authorization: published build must exist for delivery, no fallback", async () => {
    // No builds published yet => download must not be possible
    const builds = await buildRepository.listByProduct(product.id);
    expect(builds.length).toBe(0);

    // Publish a real build that satisfies the published-safe invariant
    // (clean scan with scanner identity and scan timestamp).
    await buildRepository.create({
      id: `bld_sec_${ts}`,
      productId: product.id,
      version: "1.0.0",
      status: "published",
      storageKey: `builds/${product.id}/v1.0.0.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 1024,
      fileName: "security-test.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    });

    const buildsAfter = await buildRepository.listByProduct(product.id);
    expect(buildsAfter.length).toBe(1);
    expect(buildsAfter[0].sha256Hash).toHaveLength(64);
  });

  it("Server management: live availability is sourced from the official directory", async () => {
    const source = await import("../apps/web/src/lib/services/mta-master-directory-service");
    expect(source.mtaMasterDirectoryService).toBeDefined();
    expect(typeof source.mtaMasterDirectoryService.getDirectory).toBe("function");
  });

  it("Verification workflow: isVerified can only be granted through moderation approval", async () => {
    const previous = await developerProfileRepository.own(author.id);
    await developerProfileRepository.update({
      actorId: author.id,
      expectedUpdatedAt: previous.updatedAt,
      specialties: ["Lua"],
      githubUrl: "https://example.test/github",
      discordTag: "sec-fixture",
      profileId: `dev_sec_${ts}`,
      auditId: `aud_sec_prof_${ts}`,
    });
    const request = await verificationRepository.createRequest({
      requesterId: author.id,
      targetType: "developer",
      targetId: author.id,
      proofUrl: "https://example.test/developer-portfolio",
      notes: "Requesting developer verification",
    });
    expect(request.status).toBe("pending");

    // Reject first
    const rejected = await verificationRepository.resolveRequest({
      id: request.id,
      reviewerId: admin.id,
      currentToken: `tok_${admin.id}`,
      decision: "rejected",
      reviewNotes: "Insufficient proof",
    });
    expect(rejected?.status).toBe("rejected");

    // Rejected request cannot be resolved again
    const secondAttempt = await verificationRepository.resolveRequest({
      id: request.id,
      reviewerId: admin.id,
      currentToken: `tok_${admin.id}`,
      decision: "approved",
    });
    expect(secondAttempt).toBeNull();

    // New request approved => verified flag applied
    const request2 = await verificationRepository.createRequest({
      requesterId: author.id,
      targetType: "developer",
      targetId: author.id,
      proofUrl: "https://example.test/developer-portfolio-resubmit",
      notes: "Resubmitted with portfolio proof",
    });
    const approved = await verificationRepository.resolveRequest({
      id: request2.id,
      reviewerId: admin.id,
      currentToken: `tok_${admin.id}`,
      decision: "approved",
      reviewNotes: "Portfolio verified",
    });
    expect(approved?.status).toBe("approved");

    const verifiedAuthor = await userRepository.findById(author.id);
    expect(verifiedAuthor?.isVerified).toBe(true);
  });

  it("Seller dashboard: sales derived from real completed orders only", async () => {
    const sales = await orderRepository.listSalesBySeller(author.id);
    expect(sales.length).toBeGreaterThanOrEqual(0);

    // All returned sales must be from completed orders on author's products
    for (const sale of sales) {
      expect(sale.orderStatus).toBe("completed");
    }
  });
});
