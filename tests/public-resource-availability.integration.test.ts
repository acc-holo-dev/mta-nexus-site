import { beforeAll, describe, expect, it } from "vitest";
import {
  buildRepository,
  productRepository,
  userRepository,
} from "@nexus/db";

describe("public resource safe-build catalog scope", () => {
  const suffix = `${Date.now().toString(36)}_${process.pid}`;
  const authorId = `usr_public_availability_${suffix}`;
  const productId = `prd_public_availability_${suffix}`;
  const slug = `public-availability-${suffix}`;

  beforeAll(async () => {
    await userRepository.create({
      id: authorId,
      email: `public_availability_${suffix}@nexus.test`,
      username: `public_availability_${suffix}`,
      displayName: "Public Availability Author",
      role: "developer",
    });

    await productRepository.create({
      id: productId,
      title: "Public Availability Resource",
      slug,
      description:
        "Resource used to prove public catalog safe-build filtering.",
      type: "script",
      status: "published",
      authorId,
      price: 0,
      currency: "USD",
      licenseModel: "unlimited",
      tags: [],
      currentVersion: "1.0.0",
      ratingAverage: 0,
      ratingCount: 0,
      salesCount: 0,
      isFeatured: false,
      screenshots: [],
      compatibility: { dependencies: [] },
    });
  });

  async function expectHidden() {
    await expect(
      productRepository.list({ query: "Public Availability Resource" }),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productId }),
      ]),
    );

    await expect(
      productRepository.pagePublishedFreeByAuthor(authorId, 1, 24),
    ).resolves.toMatchObject({
      products: expect.not.arrayContaining([
        expect.objectContaining({ id: productId }),
      ]),
    });

    await expect(
      productRepository.findPublishedFreeBySlugs([slug]),
    ).resolves.toEqual([]);
  }

  async function expectVisible() {
    await expect(
      productRepository.list({ query: "Public Availability Resource" }),
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: productId }),
      ]),
    );

    await expect(
      productRepository.pagePublishedFreeByAuthor(authorId, 1, 24),
    ).resolves.toMatchObject({
      products: expect.arrayContaining([
        expect.objectContaining({ id: productId }),
      ]),
    });

    await expect(
      productRepository.findPublishedFreeBySlugs([slug]),
    ).resolves.toEqual([
      expect.objectContaining({ id: productId }),
    ]);
  }

  it("hides a published product that has no build", async () => {
    await expectHidden();
  });

  it("rejects a published clean build without scan provenance at the database boundary", async () => {
    await expect(buildRepository.create({
      id: `bld_public_unsafe_${suffix}`,
      productId,
      version: "1.0.0",
      status: "published",
      storageKey: `assets/test/public-unsafe-${suffix}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 16,
      fileName: "public-unsafe.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      isSigned: false,
    })).rejects.toMatchObject({
      cause: {
        code: "23514",
        constraint_name: "builds_clean_scan_provenance_check",
      },
    });

    await expectHidden();
  });

  it("hides a product whose clean build is still awaiting review", async () => {
    await buildRepository.create({
      id: `bld_public_pending_${suffix}`,
      productId,
      version: "1.0.1",
      status: "pending_review",
      storageKey: `assets/test/public-pending-${suffix}.zip`,
      sha256Hash: "c".repeat(64),
      fileSizeBytes: 16,
      fileName: "public-pending.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    await expectHidden();
  });

  it("exposes the product once a provenance-backed clean published build exists", async () => {
    await buildRepository.create({
      id: `bld_public_safe_${suffix}`,
      productId,
      version: "1.1.0",
      status: "published",
      storageKey: `assets/test/public-safe-${suffix}.zip`,
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 32,
      fileName: "public-safe.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      isSigned: false,
    });

    await expectVisible();
    await expect(productRepository.countPublishedFree()).resolves.toBeGreaterThan(
      0,
    );
  });
});
