import {
  buildRepository,
  contentRepository,
  db,
  developerProfileRepository,
  licenseRepository,
  notificationRepository,
  orderItems,
  orderRepository,
  orders,
  productRepository,
  sessionRepository,
  socialRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";
import type { Product, User } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it } from "vitest";
import { GET as downloadAdminBuild } from "../../src/app/api/admin/builds/[buildId]/download/route";
import { GET as downloadProduct } from "../../src/app/api/products/[id]/download/route";
import { commerceService } from "../../src/lib/services/commerce/commerce-service";

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

    await sessionRepository.create({
      id: `ses_${author.id}`,
      userId: author.id,
      token: `tok_${author.id}`,
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
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

    await expect(
      contentRepository.addComment({
        id: `cmt_sec_unpaid_${ts}`,
        productId: reviewProduct.id,
        authorId: userB.id,
        text: "Unpaid buyer review must be refused",
        rating: 4,
        isVerifiedPurchase: true,
      }),
    ).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });

    await expect(
      contentRepository.addComment({
        id: `cmt_sec_author_${ts}`,
        productId: reviewProduct.id,
        authorId: author.id,
        text: "Author self-review must be refused",
        rating: 5,
        isVerifiedPurchase: true,
      }),
    ).rejects.toMatchObject({ code: "REVIEW_ACCESS_REQUIRED" });

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

    await expect(
      contentRepository.addComment({
        id: `cmt_sec_repeat_${ts}`,
        productId: reviewProduct.id,
        authorId: userB.id,
        text: "A second review must be refused",
        rating: 3,
        isVerifiedPurchase: true,
      }),
    ).rejects.toMatchObject({ code: "REVIEW_CHANGED" });

    // Duplicate review must be detectable
    const duplicate = await contentRepository.hasReviewFromUser(reviewProduct.id, userB.id);
    expect(duplicate).toBe(true);
  });

  it("Follow validation: target must exist and self-follow is blocked at contract level", async () => {
    await expect(
      socialRepository.follow({
        id: `fol_sec_self_${ts}`,
        followerId: userA.id,
        targetType: "user",
        targetId: userA.id,
      }),
    ).rejects.toMatchObject({ code: "SELF_FOLLOW" });
    await expect(
      socialRepository.follow({
        id: `fol_sec_missing_${ts}`,
        followerId: userA.id,
        targetType: "product",
        targetId: "prd_does_not_exist_xyz",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await socialRepository.isFollowing(userA.id, "user", userA.id)).toBe(false);
    expect(await socialRepository.isFollowing(userA.id, "product", "prd_does_not_exist_xyz")).toBe(
      false,
    );

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
    const downloadContext = { params: Promise.resolve({ id: product.id }) };
    const sameOrigin = () =>
      new NextRequest(`http://nexus.test/api/products/${product.id}/download`, {
        method: "GET",
        headers: {
          cookie: `nexus_session=tok_${author.id}`,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
        },
      });
    const crossSite = () =>
      new NextRequest(`http://nexus.test/api/products/${product.id}/download`, {
        method: "GET",
        headers: {
          cookie: `nexus_session=tok_${author.id}`,
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      });

    // No builds published yet => download must not be possible
    const builds = await buildRepository.listByProduct(product.id);
    expect(builds.length).toBe(0);
    const emptyDownload = await downloadProduct(sameOrigin(), downloadContext);
    expect(emptyDownload.status).toBe(404);
    expect(await emptyDownload.json()).toMatchObject({
      error: "No published build is available",
    });
    const crossSiteEmpty = await downloadProduct(crossSite(), downloadContext);
    expect(crossSiteEmpty.status).toBe(401);

    // An unpublished build is still not a delivery fallback.
    await buildRepository.create({
      id: `bld_sec_${ts}`,
      productId: product.id,
      version: "1.0.0",
      status: "draft",
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
    expect(buildsAfter[0].status).not.toBe("published");
    const unpublishedDownload = await downloadProduct(sameOrigin(), downloadContext);
    expect(unpublishedDownload.status).toBe(404);
    expect(await unpublishedDownload.json()).toMatchObject({
      error: "No published build is available",
    });

    const quarantined = await buildRepository.create({
      id: `bld_sec_quar_${ts}`,
      productId: product.id,
      version: "1.0.1",
      status: "quarantined",
      quarantinePreviousStatus: "pending_review",
      quarantineReason: "Clean scan held out of reviewer delivery",
      quarantinedAt: new Date(),
      storageKey: `builds/${product.id}/v1.0.1.zip`,
      sha256Hash: "c".repeat(64),
      fileSizeBytes: 1024,
      fileName: "quarantined.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    });
    const adminContext = { params: Promise.resolve({ buildId: quarantined.id }) };
    const adminSameOrigin = await downloadAdminBuild(
      new NextRequest(`http://nexus.test/api/admin/builds/${quarantined.id}/download`, {
        method: "GET",
        headers: {
          cookie: `nexus_session=tok_${admin.id}`,
          "sec-fetch-site": "same-origin",
          "sec-fetch-mode": "cors",
          "sec-fetch-dest": "empty",
        },
      }),
      adminContext,
    );
    expect(adminSameOrigin.status).toBe(409);
    const adminCrossSite = await downloadAdminBuild(
      new NextRequest(`http://nexus.test/api/admin/builds/${quarantined.id}/download`, {
        method: "GET",
        headers: {
          cookie: `nexus_session=tok_${admin.id}`,
          "sec-fetch-site": "cross-site",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        },
      }),
      adminContext,
    );
    expect(adminCrossSite.status).toBe(403);
  });

  it("Server management: live availability is sourced from the official directory", async () => {
    const source = await import("../../src/lib/services/servers/mta-master-directory-service");
    expect(source.mtaMasterDirectoryService).toBeDefined();
    expect(typeof source.mtaMasterDirectoryService.getDirectory).toBe("function");
  });

  it("Verification workflow: isVerified can only be granted through moderation approval", async () => {
    const previous = await developerProfileRepository.own(author.id);
    await developerProfileRepository.update({
      actorId: author.id,
      currentToken: `tok_${author.id}`,
      expectedUpdatedAt: previous.updatedAt,
      specialties: ["Lua"],
      githubUrl: "https://example.test/github",
      discordTag: "sec-fixture",
      profileId: `dev_sec_${ts}`,
      auditId: `aud_sec_prof_${ts}`,
    });
    const request = await verificationRepository.createRequest({
      requesterId: author.id,
      currentToken: `tok_${author.id}`,
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
      currentToken: `tok_${author.id}`,
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
    const pendingId = `ord_sec_pending_${ts}`;
    const completedId = `ord_sec_completed_${ts}`;
    await db.insert(orders).values([
      {
        id: pendingId,
        orderNumber: `PEND-${ts}`,
        buyerId: userB.id,
        status: "pending",
        totalAmount: 0,
        currency: "USD",
      },
      {
        id: completedId,
        orderNumber: `DONE-${ts}`,
        buyerId: userA.id,
        status: "completed",
        totalAmount: 0,
        currency: "USD",
      },
    ]);
    await db.insert(orderItems).values([
      {
        id: `oit_sec_pending_${ts}`,
        orderId: pendingId,
        productId: product.id,
        unitPrice: 0,
        currency: "USD",
      },
      {
        id: `oit_sec_completed_${ts}`,
        orderId: completedId,
        productId: product.id,
        unitPrice: 0,
        currency: "USD",
      },
    ]);

    const sales = await orderRepository.listSalesBySeller(author.id);
    expect(sales.length).toBeGreaterThan(0);
    expect(sales.map((sale) => sale.orderId)).toContain(completedId);
    expect(sales.map((sale) => sale.orderId)).not.toContain(pendingId);

    // All returned sales must be from completed orders on author's products
    for (const sale of sales) {
      expect(sale.orderStatus).toBe("completed");
    }
  });
});
