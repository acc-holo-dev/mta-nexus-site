import { randomBytes } from "node:crypto";
import { inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  buildRepository, builds, db, productRepository, products, userRepository, users,
} from "@nexus/db";

describe("published build archive (PostgreSQL)", () => {
  it("paginates only currently deliverable versions and scopes exact downloads", async () => {
    const suffix = randomBytes(6).toString("hex");
    const authorId = `usr_release_${suffix}`;
    const productId = `prd_release_${suffix}`;
    const otherProductId = `prd_release_other_${suffix}`;
    const safeIds = Array.from({ length: 15 }, (_, index) => `bld_release_${index}_${suffix}`);
    const unsafeId = `bld_release_unsafe_${suffix}`;
    const retiredId = `bld_release_retired_${suffix}`;
    const quarantinedId = `bld_release_quarantined_${suffix}`;
    const otherId = `bld_release_other_${suffix}`;
    const buildIds = [...safeIds, unsafeId, retiredId, quarantinedId, otherId];
    try {
      await userRepository.create({
        id: authorId,
        username: `release_${suffix}`,
        email: `release_${suffix}@nexus.test`,
        displayName: "Release fixture author",
        role: "developer",
      });
      const base = {
        authorId, type: "script" as const, status: "published" as const,
        price: 0, currency: "USD",
        licenseModel: "unlimited" as const, tags: [],
        currentVersion: "1.0.0", ratingAverage: 0, ratingCount: 0,
        salesCount: 0, isFeatured: false, screenshots: [],
        compatibility: {},
      };
      await productRepository.create({
        ...base,
        id: productId,
        slug: `release-test-${suffix}`,
        title: "Release fixture",
        description: "Public release metadata test",
      });
      await productRepository.create({
        ...base,
        id: otherProductId,
        slug: `release-other-${suffix}`,
        title: "Unrelated release fixture",
        description: "Unrelated product's builds must not be readable",
      });

      const common = {
        productId,
        releaseNotes: "Public release notes",
        fileSizeBytes: 12,
        fileName: "release.zip",
        mimeType: "application/zip",
        sha256Hash: "a".repeat(64),
        scanStatus: "clean" as const,
        scanner: "integration-test",
        scannedAt: new Date("2026-10-09T10:00:00Z"),
        isSigned: false,
      };
      for (let index = 0; index < safeIds.length; index++) {
        await buildRepository.create({
          ...common,
          id: safeIds[index],
          version: `1.0.${index}`,
          storageKey: `test/private/${safeIds[index]}.zip`,
          status: "published",
        });
      }
      await buildRepository.create({
        ...common, id: unsafeId, version: "2.0.0",
        storageKey: "test/private/unsafe.zip",
        // Non-published: published requires scan_status=clean (builds_published_safe_check).
        status: "rejected",
        scanStatus: "error", scanner: undefined, scannedAt: undefined,
      });
      await buildRepository.create({
        ...common, id: retiredId, version: "2.0.1",
        storageKey: "test/private/retired.zip",
        status: "retired",
      });
      await buildRepository.create({
        ...common, id: quarantinedId, version: "2.0.2",
        storageKey: "test/private/quarantined.zip",
        status: "quarantined",
        quarantinePreviousStatus: "published",
        quarantineReason: "Fixture quarantine",
        quarantinedAt: new Date("2026-10-09T12:00:00Z"),
      });
      await buildRepository.create({
        ...common, id: otherId, productId: otherProductId,
        version: "3.0.0",
        storageKey: "test/private/unrelated.zip",
        status: "published",
      });

      const first = await buildRepository.pagePublishedReleases(productId, 1);
      const second = await buildRepository.pagePublishedReleases(productId, 2);
      expect(first).toMatchObject({
        total: 15, page: 1, totalPages: 2, pageSize: 12,
      });
      expect(first.releases).toHaveLength(12);
      expect(second.releases).toHaveLength(3);
      const observedIds = [...first.releases, ...second.releases].map(row => row.id);
      expect(new Set(observedIds).size).toBe(15);
      expect(new Set(observedIds)).toEqual(new Set(safeIds));
      expect(first.releases.every(row =>
        !("storageKey" in row) && !("quarantineReason" in row) &&
        !("quarantinedBy" in row),
      )).toBe(true);
      expect(first.releases.every(row =>
        row.scanStatus === "clean" && row.scanner === "integration-test",
      )).toBe(true);
      expect((await buildRepository.pagePublishedReleases(productId, 999999)).page).toBe(2);

      const selected = await buildRepository.findPublishedByProductAndId(productId, safeIds[0]);
      expect(selected?.id).toBe(safeIds[0]);
      expect(await buildRepository.findPublishedByProductAndId(productId, otherId)).toBeNull();
      expect(await buildRepository.findPublishedByProductAndId(productId, unsafeId)).toBeNull();
      expect(await buildRepository.findPublishedByProductAndId(productId, retiredId)).toBeNull();
      expect(await buildRepository.findPublishedByProductAndId(productId, quarantinedId)).toBeNull();

      await buildRepository.updateStatus(safeIds[0], "retired", "published");
      expect(await buildRepository.findPublishedByProductAndId(productId, safeIds[0])).toBeNull();
      const afterRetirement = await buildRepository.pagePublishedReleases(productId);
      expect(afterRetirement.total).toBe(14);
    } finally {
      await db.delete(builds).where(inArray(builds.id, buildIds));
      await db.delete(products).where(inArray(products.id, [productId, otherProductId]));
      await db.delete(users).where(inArray(users.id, [authorId]));
    }
  });
});
