import { beforeAll, describe, expect, it } from "vitest";
import { productRepository, userRepository } from "@nexus/db";

describe("reverse dependency repository integration", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_rev_dep_${suffix}`;
  const targetSlug = `reverse-target-${suffix}`;
  const publishedSlug = `reverse-public-${suffix}`;
  const draftSlug = `reverse-draft-${suffix}`;
  const paidSlug = `reverse-paid-${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `reverse_dependency_${suffix}@nexus.test`,
      username: `reverse_dependency_${suffix}`,
      displayName: "Reverse Dependency Author",
      role: "developer",
    });

    const base = {
      description: "Reverse dependency integration resource",
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
    };

    await productRepository.create({
      ...base,
      id: `prd_rev_target_${suffix}`,
      title: "Reverse target",
      slug: targetSlug,
      status: "published",
      price: 0,
      compatibility: { dependencies: [targetSlug] },
    });
    await productRepository.create({
      ...base,
      id: `prd_rev_public_${suffix}`,
      title: "Public dependent",
      slug: publishedSlug,
      status: "published",
      price: 0,
      compatibility: { dependencies: [targetSlug] },
    });
    await productRepository.create({
      ...base,
      id: `prd_rev_draft_${suffix}`,
      title: "Draft dependent",
      slug: draftSlug,
      status: "draft",
      price: 0,
      compatibility: { dependencies: [targetSlug] },
    });
    await productRepository.create({
      ...base,
      id: `prd_rev_paid_${suffix}`,
      title: "Legacy paid dependent",
      slug: paidSlug,
      status: "published",
      price: 100,
      compatibility: { dependencies: [targetSlug] },
    });
  });

  it("returns only other published free resources declaring the target slug", async () => {
    const rows =
      await productRepository.listPublishedFreeDependingOnSlug(
        targetSlug,
        51,
      );

    expect(rows.map((row) => row.slug)).toEqual([publishedSlug]);
  });
});
