import { beforeAll, describe, expect, it } from "vitest";
import {
  auditRepository,
  buildRepository,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("build quarantine lifecycle", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const moderatorId = `usr_quarantine_mod_${suffix}`;
  const authorId = `usr_quarantine_author_${suffix}`;
  const productId = `prd_quarantine_${suffix}`;
  const oldBuildId = `bld_quarantine_old_${suffix}`;
  const newBuildId = `bld_quarantine_new_${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: moderatorId,
      email: `quarantine_mod_${suffix}@nexus.test`,
      username: `quarantine_mod_${suffix}`,
      displayName: "Quarantine Moderator",
      role: "admin",
    });
    await userRepository.create({
      id: authorId,
      email: `quarantine_author_${suffix}@nexus.test`,
      username: `quarantine_author_${suffix}`,
      displayName: "Quarantine Author",
      role: "developer",
    });
    await productRepository.create({
      id: productId,
      title: "Quarantine Resource",
      slug: `quarantine-resource-${suffix}`,
      description: "Quarantine lifecycle fixture",
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

    for (const [id, version, hash] of [
      [oldBuildId, "1.0.0", "a".repeat(64)],
      [newBuildId, "2.0.0", "b".repeat(64)],
    ] as const) {
      await buildRepository.create({
        id,
        productId,
        version,
        releaseNotes: "fixture",
        status: "pending_review",
        storageKey: `fixtures/${id}.zip`,
        sha256Hash: hash,
        fileSizeBytes: 10,
        fileName: `${version}.zip`,
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "test-scanner",
        scannedAt: new Date(),
        isSigned: false,
      });
      await buildRepository.moderatePending(id, "approve", {
        id: `aud_approve_${id}`,
        actorId: moderatorId,
        actorType: "admin",
        action: "build.approved",
        targetId: id,
        targetType: "build",
      });
    }
  });

  it("removes the affected build from public delivery and falls back atomically", async () => {
    const quarantined = await buildRepository.quarantinePublishedAndRefreshProduct(
      newBuildId,
      moderatorId,
      "Suspicious behavior under investigation",
      {
        id: `aud_quarantine_${suffix}`,
        actorId: moderatorId,
        actorType: "admin",
        action: "build.quarantined",
        targetId: newBuildId,
        targetType: "build",
        details: { reason: "Suspicious behavior under investigation" },
      },
    );

    expect(quarantined).toMatchObject({
      status: "quarantined",
      quarantinePreviousStatus: "published",
      quarantineReason: "Suspicious behavior under investigation",
      quarantinedBy: moderatorId,
    });
    expect(quarantined?.quarantinedAt).toBeInstanceOf(Date);

    const latest = await buildRepository.findLatestPublishedByProduct(productId);
    const product = await productRepository.findById(productId);
    expect(latest?.id).toBe(oldBuildId);
    expect(product?.status).toBe("published");
    expect(product?.currentVersion).toBe("1.0.0");
  });

  it("restores only through the trusted-clean publication path and clears live quarantine metadata", async () => {
    const restored = await buildRepository.restoreQuarantinedAndRefreshProduct(
      newBuildId,
      {
        id: `aud_restore_${suffix}`,
        actorId: moderatorId,
        actorType: "admin",
        action: "build.quarantine_restored",
        targetId: newBuildId,
        targetType: "build",
        details: { reason: "Investigation cleared the build" },
      },
    );

    expect(restored).toMatchObject({
      status: "published",
      quarantinePreviousStatus: null,
      quarantineReason: null,
      quarantinedAt: null,
      quarantinedBy: null,
    });
    const latest = await buildRepository.findLatestPublishedByProduct(productId);
    const product = await productRepository.findById(productId);
    expect(latest?.id).toBe(newBuildId);
    expect(product?.status).toBe("published");
    expect(product?.currentVersion).toBe("2.0.0");

    const audit = await auditRepository.listRecent(100);
    expect(audit.some((event) =>
      event.targetId === newBuildId &&
      event.action === "build.quarantined"
    )).toBe(true);
    expect(audit.some((event) =>
      event.targetId === newBuildId &&
      event.action === "build.quarantine_restored"
    )).toBe(true);
  });
});
