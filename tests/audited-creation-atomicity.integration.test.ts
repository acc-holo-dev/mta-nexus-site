import { describe, expect, it } from "vitest";
import {
  auditEvents,
  contentRepository,
  db,
  productRepository,
  serverRepository,
  userRepository,
  verificationRepository,
} from "@nexus/db";

describe("audited creation atomicity", () => {
  it("rolls back created rows when the paired audit insert fails", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const userId = `usr_create_atomic_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `create_atomic_${suffix}@nexus.test`,
      username: `create_atomic_${suffix}`,
      displayName: "Create Atomic User",
      role: "developer",
    });

    async function occupyAudit(id: string, targetId: string) {
      await db.insert(auditEvents).values({
        id,
        actorId: userId,
        actorType: "user",
        action: "fixture.audit",
        targetId,
        targetType: "fixture",
        createdAt: new Date(),
      });
    }

    const productId = `prd_create_atomic_${suffix}`;
    const productAudit = `aud_create_product_${suffix}`;
    await occupyAudit(productAudit, productId);
    await expect(
      productRepository.createWithAudit(
        {
          id: productId,
          title: "Atomic Product",
          slug: `atomic-product-${suffix}`,
          description: "Must roll back with audit.",
          type: "script",
          status: "draft",
          authorId: userId,
          price: 0,
          currency: "USD",
          licenseModel: "unlimited",
          tags: [],
          currentVersion: "0.1.0",
          ratingAverage: 0,
          ratingCount: 0,
          salesCount: 0,
          isFeatured: false,
          screenshots: [],
          compatibility: { dependencies: [] },
        },
        {
          id: productAudit,
          actorId: userId,
          actorType: "user",
          action: "product.created",
          targetId: productId,
          targetType: "product",
        },
      ),
    ).rejects.toBeTruthy();
    expect(await productRepository.findById(productId)).toBeNull();

    const serverId = `srv_create_atomic_${suffix}`;
    const serverAudit = `aud_create_server_${suffix}`;
    await occupyAudit(serverAudit, serverId);
    await expect(
      serverRepository.createWithAudit(
        {
          id: serverId,
          name: "Atomic Server",
          slug: `atomic-server-${suffix}`,
          ipAddress: "198.51.100.231",
          port: 20_000 + (process.pid % 20_000),
          ownerId: userId,
          status: "active",
          visibility: "private",
          isVerified: false,
          gameplayTags: [],
          mediaUrls: [],
        },
        {
          id: serverAudit,
          actorId: userId,
          actorType: "user",
          action: "server.created",
          targetId: serverId,
          targetType: "server",
        },
      ),
    ).rejects.toBeTruthy();
    expect(await serverRepository.findById(serverId)).toBeNull();

    const contentId = `cnt_create_atomic_${suffix}`;
    const contentAudit = `aud_create_content_${suffix}`;
    await occupyAudit(contentAudit, contentId);
    await expect(
      contentRepository.createWithAudit(
        {
          id: contentId,
          title: "Atomic Content",
          slug: `atomic-content-${suffix}`,
          body: "Must roll back with audit.",
          type: "article",
          authorId: userId,
          status: "draft",
          viewCount: 0,
          likeCount: 0,
          commentCount: 0,
          tags: [],
        },
        {
          id: contentAudit,
          actorId: userId,
          actorType: "user",
          action: "content.created",
          targetId: contentId,
          targetType: "content",
        },
      ),
    ).rejects.toBeTruthy();
    expect(await contentRepository.findById(contentId)).toBeNull();

    const verificationAudit = `aud_create_verification_${suffix}`;
    await occupyAudit(verificationAudit, userId);
    await expect(
      verificationRepository.createRequest(
        {
          requesterId: userId,
          targetType: "user",
          targetId: userId,
          notes: "Must roll back with audit.",
        },
        {
          id: verificationAudit,
          actorId: userId,
          actorType: "user",
          action: "verification.requested",
        },
      ),
    ).rejects.toBeTruthy();

    expect(
      await verificationRepository.findPendingForTarget(
        userId,
        "user",
        userId,
      ),
    ).toBeNull();
  });
});
