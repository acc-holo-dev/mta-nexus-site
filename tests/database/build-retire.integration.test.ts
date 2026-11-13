import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { auditEvents, buildRepository, db, productRepository, userRepository } from "@nexus/db";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

async function fixture(label: string, versions: string[]) {
  const suffix = `${label}_${randomBytes(5).toString("hex")}`;
  const userId = `usr_retire_${suffix}`;
  const productId = `prd_retire_${suffix}`;

  await userRepository.create({
    id: userId,
    email: `retire_${suffix}@example.invalid`,
    username: `retire_${suffix}`,
    displayName: "Retire Build Owner",
    role: "developer",
  });

  await productRepository.create({
    id: productId,
    authorId: userId,
    title: "Retirement resource",
    slug: `retirement-${suffix}`,
    description: "Build lifecycle integration resource.",
    type: "script",
    status: "published",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    currentVersion: versions.at(-1) ?? "1.0.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    screenshots: [],
    compatibility: { dependencies: [] },
  });

  const buildIds: string[] = [];
  for (const [index, version] of versions.entries()) {
    const buildId = `bld_retire_${index}_${suffix}`;
    buildIds.push(buildId);
    await buildRepository.create({
      id: buildId,
      productId,
      version,
      releaseNotes: `Release ${version}`,
      status: "published",
      storageKey: `test/${buildId}.zip`,
      sha256Hash: String(index + 1)
        .repeat(64)
        .slice(0, 64),
      fileSizeBytes: 10 + index,
      fileName: `${version}.zip`,
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration",
      scannedAt: new Date(Date.now() + index),
      isSigned: false,
    });
  }

  return { userId, productId, buildIds };
}

function audit(id: string, actorId: string, buildId: string) {
  return {
    id,
    actorId,
    actorType: "admin" as const,
    action: "build.retired",
    targetId: buildId,
    targetType: "build",
    details: { reason: "Lifecycle integration" },
  };
}

describe("build retirement persistence", () => {
  it("retires the last published build and returns the product to draft", async () => {
    const f = await fixture("last", ["1.0.0"]);
    const buildId = f.buildIds[0];
    assert.ok(buildId);

    await expect(
      buildRepository.retireAndRefreshProduct(
        buildId,
        "published",
        audit(`aud_${buildId}`, f.userId, buildId),
      ),
    ).resolves.toMatchObject({
      id: buildId,
      status: "retired",
    });

    await expect(productRepository.findById(f.productId)).resolves.toMatchObject({
      id: f.productId,
      status: "draft",
    });
    await expect(
      db.select().from(auditEvents).where(eq(auditEvents.targetId, buildId)),
    ).resolves.toHaveLength(1);

    await expect(
      buildRepository.retireAndRefreshProduct(
        buildId,
        "published",
        audit(`aud_${buildId}_replay`, f.userId, buildId),
      ),
    ).resolves.toBeNull();
  });

  it("promotes the remaining published version when the current build retires", async () => {
    const f = await fixture("fallback", ["1.0.0", "2.0.0"]);
    const latestBuildId = f.buildIds[1];
    assert.ok(latestBuildId);

    await expect(
      buildRepository.retireAndRefreshProduct(
        latestBuildId,
        "published",
        audit(`aud_${latestBuildId}`, f.userId, latestBuildId),
      ),
    ).resolves.toMatchObject({
      id: latestBuildId,
      status: "retired",
    });

    await expect(productRepository.findById(f.productId)).resolves.toMatchObject({
      status: "published",
      currentVersion: "1.0.0",
    });
  });

  it("keeps a newer pending version in product review scope after retirement", async () => {
    const f = await fixture("pending", ["1.0.0"]);
    const publishedId = f.buildIds[0];
    assert.ok(publishedId);
    const pendingId = `bld_retire_pending_${f.productId.slice(-10)}`;
    await buildRepository.create({
      id: pendingId,
      productId: f.productId,
      version: "1.1.0",
      releaseNotes: "Pending follow-up",
      status: "pending_review",
      storageKey: `test/${pendingId}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 12,
      fileName: "1.1.0.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration",
      scannedAt: new Date(),
      isSigned: false,
    });

    await expect(
      buildRepository.retireAndRefreshProduct(
        publishedId,
        "published",
        audit(`aud_${publishedId}_pending`, f.userId, publishedId),
      ),
    ).resolves.toMatchObject({ id: publishedId, status: "retired" });

    await expect(productRepository.findById(f.productId)).resolves.toMatchObject({
      status: "pending_review",
      currentVersion: "1.1.0",
    });
  });
});
