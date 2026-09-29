import { beforeAll, describe, expect, it } from "vitest";
import {
  productRepository,
  userRepository,
  buildRepository,
} from "@nexus/db";

describe("published dependency repository integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_dep_${suffix}`;
  const publishedSlug = `dep-published-${suffix}`;
  const draftSlug = `dep-draft-${suffix}`;
  const paidSlug = `dep-paid-${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `dependency_${suffix}@nexus.test`,
      username: `dependency_${suffix}`,
      displayName: "Dependency Test Author",
      role: "developer",
    });

    const base = {
      description: "Dependency resolver integration resource",
      type: "script" as const,
      authorId,
      currency: "USD",
      licenseModel: "unlimited" as const,
      tags: [],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: { dependencies: [] },
    };

    await productRepository.create({
      ...base,
      id: `prd_dep_pub_${suffix}`,
      title: "Published dependency",
      slug: publishedSlug,
      status: "published",
      price: 0,
    });
    await productRepository.create({
      ...base,
      id: `prd_dep_draft_${suffix}`,
      title: "Draft dependency",
      slug: draftSlug,
      status: "draft",
      price: 0,
    });
    await productRepository.create({
      ...base,
      id: `prd_dep_paid_${suffix}`,
      title: "Legacy paid dependency",
      slug: paidSlug,
      status: "published",
      price: 100,
    });

    // Published free dependency targets are public only with a trusted clean
    // build (fail-closed visibility policy).
    await buildRepository.create({
      id: `bld_dep_pub_${suffix}`,
      productId: `prd_dep_pub_${suffix}`,
      version: "1.0.0",
      status: "published",
      storageKey: `builds/prd_dep_pub_${suffix}/v1.0.0.zip`,
      sha256Hash: "e".repeat(64),
      fileSizeBytes: 2048,
      fileName: "dependency-target.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    });
  });

  it("returns only public published free dependency targets", async () => {
    const rows = await productRepository.findPublishedFreeBySlugs([
      publishedSlug,
      draftSlug,
      paidSlug,
    ]);

    expect(rows.map((row) => row.slug)).toEqual([publishedSlug]);
  });
});
