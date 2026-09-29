import { describe, expect, it } from "vitest";
import {
  contentRepository,
  organizationRepository,
  productRepository,
  userRepository,
  buildRepository,
} from "@nexus/db";

describe("organization public listing integration", () => {
  it("returns only published rows for the requested organization", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}`;
    const ownerId = `usr_org_listing_${suffix}`;
    const orgAId = `org_listing_a_${suffix}`;
    const orgBId = `org_listing_b_${suffix}`;

    await userRepository.create({
      id: ownerId,
      email: `org_listing_${suffix}@nexus.test`,
      username: `org_listing_${suffix}`,
      displayName: "Organization Listing Owner",
      role: "developer",
    });

    await organizationRepository.create({
      id: orgAId,
      name: "Listing Organization A",
      slug: `listing-org-a-${suffix}`,
      ownerId,
    });
    await organizationRepository.create({
      id: orgBId,
      name: "Listing Organization B",
      slug: `listing-org-b-${suffix}`,
      ownerId,
    });

    const baseProduct = {
      description: "Organization listing integration resource.",
      type: "script" as const,
      authorId: ownerId,
      price: 0,
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
      ...baseProduct,
      id: `prd_org_a_pub_${suffix}`,
      title: "A Published Resource",
      slug: `a-published-resource-${suffix}`,
      organizationId: orgAId,
      status: "published",
    });
    await productRepository.create({
      ...baseProduct,
      id: `prd_org_a_draft_${suffix}`,
      title: "A Draft Resource",
      slug: `a-draft-resource-${suffix}`,
      organizationId: orgAId,
      status: "draft",
    });
    await productRepository.create({
      ...baseProduct,
      id: `prd_org_a_paid_${suffix}`,
      title: "A Legacy Paid Resource",
      slug: `a-legacy-paid-resource-${suffix}`,
      organizationId: orgAId,
      status: "published",
      price: 100,
    });
    await productRepository.create({
      ...baseProduct,
      id: `prd_org_b_pub_${suffix}`,
      title: "B Published Resource",
      slug: `b-published-resource-${suffix}`,
      organizationId: orgBId,
      status: "published",
    });

    // Public free listings only expose published resources with a trusted
    // clean build (fail-closed visibility policy).
    await buildRepository.create({
      id: `bld_org_a_pub_${suffix}`,
      productId: `prd_org_a_pub_${suffix}`,
      version: "1.0.0",
      status: "published",
      storageKey: `builds/prd_org_a_pub_${suffix}/v1.0.0.zip`,
      sha256Hash: "d".repeat(64),
      fileSizeBytes: 2048,
      fileName: "organization-listing.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "test-scanner",
      scannedAt: new Date(),
      isSigned: false,
    });

    const baseContent = {
      body: "Organization listing integration content.",
      type: "article" as const,
      authorId: ownerId,
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
      tags: [],
    };

    await contentRepository.create({
      ...baseContent,
      id: `cnt_org_a_pub_${suffix}`,
      title: "A Published Article",
      slug: `a-published-article-${suffix}`,
      organizationId: orgAId,
      status: "published",
      publishedAt: new Date(),
    });
    await contentRepository.create({
      ...baseContent,
      id: `cnt_org_a_draft_${suffix}`,
      title: "A Draft Article",
      slug: `a-draft-article-${suffix}`,
      organizationId: orgAId,
      status: "draft",
    });
    await contentRepository.create({
      ...baseContent,
      id: `cnt_org_b_pub_${suffix}`,
      title: "B Published Article",
      slug: `b-published-article-${suffix}`,
      organizationId: orgBId,
      status: "published",
      publishedAt: new Date(),
    });

    const products = await productRepository.listPublishedByOrganization(
      orgAId,
      100,
    );
    const articles = await contentRepository.listPublishedByOrganization(
      orgAId,
      100,
    );

    expect(products.map((item) => item.title)).toEqual([
      "A Published Resource",
    ]);
    expect(articles.map((item) => item.title)).toEqual([
      "A Published Article",
    ]);
  });
});
