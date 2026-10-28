import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  auditEvents,
  buildRepository,
  builds,
  db,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("build submission transaction atomicity", () => {
  it("rolls back build and product state when audit persistence fails", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const userId = `usr_build_atomic_${suffix}`;
    const productId = `prd_build_atomic_${suffix}`;
    const buildId = `bld_build_atomic_${suffix}`;
    const auditId = `aud_build_atomic_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `build_atomic_${suffix}@nexus.test`,
      username: `build_atomic_${suffix}`,
      displayName: "Build Atomic Author",
      role: "developer",
    });
    await productRepository.create({
      id: productId,
      title: "Atomic Build Resource",
      slug: `atomic-build-${suffix}`,
      description: "Build transaction rollback fixture.",
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
    });

    await db.insert(auditEvents).values({
      id: auditId,
      actorId: userId,
      actorType: "user",
      action: "fixture.audit",
      targetId: buildId,
      targetType: "build",
      createdAt: new Date(),
    });

    await expect(
      buildRepository.submitForReview(
        {
          id: buildId,
          productId,
          version: "1.0.0",
          releaseNotes: "Atomic submit fixture",
          status: "pending_review",
          storageKey: `test/${buildId}.zip`,
          sha256Hash: "a".repeat(64),
          fileSizeBytes: 16,
          fileName: "resource.zip",
          mimeType: "application/zip",
          scanStatus: "clean",
          scanner: "integration",
          scannedAt: new Date(),
          isSigned: false,
        },
        {
          id: auditId,
          actorId: userId,
          actorType: "user",
          action: "build.submitted_for_review",
          targetId: buildId,
          targetType: "build",
        },
      ),
    ).rejects.toBeTruthy();

    const storedBuilds = await db.select().from(builds).where(eq(builds.id, buildId));
    expect(storedBuilds).toHaveLength(0);

    await expect(productRepository.findById(productId)).resolves.toMatchObject({
      id: productId,
      status: "draft",
      currentVersion: "0.1.0",
    });
  });
});
