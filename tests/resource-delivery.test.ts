import type { Readable } from "node:stream";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildRepository, userRepository } from "@nexus/db";
import { storageService } from "@nexus/storage";
import { commerceService } from "../apps/web/src/lib/services/commerce-service";
import { productService } from "../apps/web/src/lib/services/product-service";
import type { Product, User } from "@nexus/domain";

describe("free resource delivery lifecycle", () => {
  const suffix = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const payload = Buffer.from("MTA Nexus integration build payload");
  let author: User;
  let player: User;
  let product: Product;
  let moderator: User;
  let storageKey: string | undefined;

  beforeAll(async () => {
    author = await userRepository.create({
      id: `usr_delivery_author_${suffix}`,
      email: `delivery_author_${suffix}@nexus.test`,
      username: `delivery_author_${suffix}`,
      displayName: "Delivery Author",
      role: "developer",
    });
    player = await userRepository.create({
      id: `usr_delivery_player_${suffix}`,
      email: `delivery_player_${suffix}@nexus.test`,
      username: `delivery_player_${suffix}`,
      displayName: "Delivery Player",
      role: "user",
    });

    moderator = await userRepository.create({
      id: `usr_delivery_moderator_${suffix}`,
      email: `delivery_moderator_${suffix}@nexus.test`,
      username: `delivery_moderator_${suffix}`,
      displayName: "Delivery Moderator",
      role: "moderator",
    });

    product = await productService.createProduct(
      {
        title: "Delivery Test Resource",
        slug: `delivery-test-${suffix}`,
        description: "A free resource used to verify binary delivery end to end.",
        type: "script",
        status: "draft",
        authorId: author.id,
        price: 0,
        currency: "USD",
        licenseModel: "unlimited",
        tags: ["integration"],
        currentVersion: "0.1.0",
        isFeatured: false,
        screenshots: [],
        compatibility: { mtaMinVersion: "1.6.0" },
      },
      author
    );
  });

  afterAll(async () => {
    if (storageKey) {
      await storageService.deleteAsset(storageKey);
    }
  });

  it("stores, publishes, claims, and reads the exact build bytes", async () => {
    const asset = await storageService.uploadAsset({
      data: payload,
      fileName: "delivery-test.zip",
      mimeType: "application/zip",
      userId: author.id,
      isPrivate: true,
    });
    storageKey = asset.key;

    const build = await productService.releaseBuild(
      {
        productId: product.id,
        version: "1.0.0",
        releaseNotes: "Initial integration build",
        storageKey: asset.key,
        sha256Hash: asset.sha256Hash,
        fileSizeBytes: asset.sizeBytes,
        fileName: "delivery-test.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "integration-fixture",
        scannedAt: new Date(),
      },
      author
    );
    expect(build.status).toBe("pending_review");
    expect(build.isSigned).toBe(false);

    const approved = await productService.reviewBuild(
      { buildId: build.id, decision: "approve", notes: "Archive verified for closed beta" },
      moderator
    );
    expect(approved.status).toBe("published");

    const publishedBuilds = await buildRepository.listByProduct(product.id);
    expect(publishedBuilds.some((candidate) => candidate.id === build.id)).toBe(true);

    const claim = await commerceService.claimFreeResource({
      user: player,
      productId: product.id,
    });
    expect(claim.alreadyClaimed).toBe(false);

    const stored = await storageService.getDownloadStream(build.storageKey);
    const chunks: Buffer[] = [];
    for await (const chunk of stored.stream as Readable) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    expect(Buffer.concat(chunks)).toEqual(payload);
    expect(stored.meta?.sizeBytes).toBe(payload.length);
  });
});
