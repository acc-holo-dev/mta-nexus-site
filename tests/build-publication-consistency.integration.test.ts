import { beforeAll, describe, expect, it } from "vitest";
import { buildRepository, productRepository, userRepository } from "@nexus/db";

describe("published build/currentVersion consistency", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_build_consistency_${suffix}`;
  const productId = `prd_build_consistency_${suffix}`;
  const olderBuildId = `bld_a_${suffix}`;
  const newerBuildId = `bld_z_${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `build_consistency_${suffix}@nexus.test`,
      username: `build_consistency_${suffix}`,
      displayName: "Build Consistency Author",
      role: "developer",
    });

    await productRepository.create({
      id: productId,
      title: "Build Consistency Resource",
      slug: `build-consistency-${suffix}`,
      description: "Resource used to prove build publication ordering.",
      type: "script",
      status: "draft",
      authorId,
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
    });

    const common = {
      productId,
      releaseNotes: "test",
      status: "pending_review" as const,
      fileSizeBytes: 10,
      mimeType: "application/zip",
      scanStatus: "clean" as const,
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    };

    await buildRepository.create({
      ...common,
      id: olderBuildId,
      version: "1.0.0",
      storageKey: `assets/test/${olderBuildId}.zip`,
      sha256Hash: "a".repeat(64),
      fileName: "older.zip",
    });

    await buildRepository.create({
      ...common,
      id: newerBuildId,
      version: "2.0.0",
      storageKey: `assets/test/${newerBuildId}.zip`,
      sha256Hash: "b".repeat(64),
      fileName: "newer.zip",
    });
  });

  it("keeps currentVersion aligned with the newest published build when approvals are out of order", async () => {
    const newer = await buildRepository.moderatePending(
      newerBuildId,
      "approve",
      {
        id: `aud_newer_${suffix}`,
        actorId: authorId,
        actorType: "admin",
        action: "build.approved",
        targetId: newerBuildId,
        targetType: "build",
      },
      1,
    );
    expect(newer?.status).toBe("published");

    const older = await buildRepository.moderatePending(
      olderBuildId,
      "approve",
      {
        id: `aud_older_${suffix}`,
        actorId: authorId,
        actorType: "admin",
        action: "build.approved",
        targetId: olderBuildId,
        targetType: "build",
      },
      1,
    );
    expect(older?.status).toBe("published");

    const product = await productRepository.findById(productId);
    const latest = await buildRepository.findLatestPublishedByProduct(productId);

    expect(latest?.id).toBe(newerBuildId);
    expect(latest?.version).toBe("2.0.0");
    expect(product?.currentVersion).toBe(latest?.version);
    expect(product?.status).toBe("published");
  });

  it("serializes concurrent approvals through the product row", async () => {
    const concurrentProductId = `prd_build_concurrent_${suffix}`;
    const firstId = `bld_concurrent_a_${suffix}`;
    const secondId = `bld_concurrent_z_${suffix}`;

    await productRepository.create({
      id: concurrentProductId,
      title: "Concurrent Build Resource",
      slug: `concurrent-build-${suffix}`,
      description: "Resource used to prove concurrent moderation consistency.",
      type: "script",
      status: "draft",
      authorId,
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
    });

    const common = {
      productId: concurrentProductId,
      releaseNotes: "concurrent test",
      status: "pending_review" as const,
      fileSizeBytes: 10,
      mimeType: "application/zip",
      scanStatus: "clean" as const,
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    };

    await buildRepository.create({
      ...common,
      id: firstId,
      version: "3.0.0",
      storageKey: `assets/test/${firstId}.zip`,
      sha256Hash: "c".repeat(64),
      fileName: "first.zip",
    });
    await buildRepository.create({
      ...common,
      id: secondId,
      version: "4.0.0",
      storageKey: `assets/test/${secondId}.zip`,
      sha256Hash: "d".repeat(64),
      fileName: "second.zip",
    });

    await Promise.all([
      buildRepository.moderatePending(
        firstId,
        "approve",
        {
          id: `aud_concurrent_a_${suffix}`,
          actorId: authorId,
          actorType: "admin",
          action: "build.approved",
          targetId: firstId,
          targetType: "build",
        },
        1,
      ),
      buildRepository.moderatePending(
        secondId,
        "approve",
        {
          id: `aud_concurrent_z_${suffix}`,
          actorId: authorId,
          actorType: "admin",
          action: "build.approved",
          targetId: secondId,
          targetType: "build",
        },
        1,
      ),
    ]);

    const product = await productRepository.findById(concurrentProductId);
    const latest = await buildRepository.findLatestPublishedByProduct(concurrentProductId);

    expect(latest?.id).toBe(secondId);
    expect(product?.currentVersion).toBe(latest?.version);
  });

  it("moves currentVersion to the same fallback that download will resolve after retirement", async () => {
    const retired = await buildRepository.retireAndRefreshProduct(newerBuildId, "published", {
      id: `aud_retire_${suffix}`,
      actorId: authorId,
      actorType: "admin",
      action: "build.retired",
      targetId: newerBuildId,
      targetType: "build",
    });
    expect(retired?.status).toBe("retired");

    const product = await productRepository.findById(productId);
    const latest = await buildRepository.findLatestPublishedByProduct(productId);

    expect(latest?.id).toBe(olderBuildId);
    expect(latest?.version).toBe("1.0.0");
    expect(product?.currentVersion).toBe(latest?.version);
  });
});
