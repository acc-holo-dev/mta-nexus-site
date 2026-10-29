import {
  auditEvents,
  buildRepository,
  builds,
  db,
  entitlementRepository,
  entitlements,
  licenseRepository,
  licenses,
  productRepository,
  products,
  resourceLibrarySelectionsRepository,
  sessionRepository,
  userLibraryRepository,
  userRepository,
  users,
} from "@nexus/db";
import { eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";

describe("effective resource library and private visibility (PostgreSQL)", () => {
  it("filters active rights, legacy licenses, safe builds and account ownership", async () => {
    const suffix = `${Date.now().toString(36)}_${process.pid}_${Math.random().toString(36).slice(2, 7)}`;
    const authorId = `usr_lib_author_${suffix}`;
    const ownerId = `usr_lib_owner_${suffix}`;
    const outsiderId = `usr_lib_other_${suffix}`;
    const actors = [authorId, ownerId, outsiderId];
    const productIds = Object.fromEntries(
      ["ready", "paid", "unsafe", "draft", "other", "expired", "revoked"].map((name) => [
        name,
        `prd_lib_${name}_${suffix}`,
      ]),
    );
    const ids = Object.values(productIds);
    const entitlementIds = [
      `ent_lib_ready_1_${suffix}`,
      `ent_lib_ready_2_${suffix}`,
      `ent_lib_unsafe_${suffix}`,
      `ent_lib_draft_${suffix}`,
      `ent_lib_expired_${suffix}`,
      `ent_lib_unrelated_${suffix}`,
      `ent_lib_outsider_${suffix}`,
    ];
    const licenseIds = [
      `lic_lib_paid_${suffix}`,
      `lic_lib_revoked_${suffix}`,
      `lic_lib_expired_${suffix}`,
    ];
    const buildIds: string[] = [];

    try {
      for (const [index, id] of actors.entries()) {
        await userRepository.create({
          id,
          username: `lib_${index}_${suffix}`,
          email: `lib_${index}_${suffix}@nexus.test`,
          displayName: "Library rights fixture",
          role: index === 0 ? "developer" : "user",
        });
      }
      const base = {
        description: "A private resource library fixture",
        type: "script" as const,
        status: "published" as const,
        authorId,
        price: 0,
        currency: "USD",
        licenseModel: "unlimited" as const,
        tags: [] as string[],
        currentVersion: "1.0.0",
        ratingAverage: 0,
        ratingCount: 0,
        salesCount: 0,
        isFeatured: false,
        screenshots: [] as string[],
        compatibility: {},
      };
      for (const [name, id] of Object.entries(productIds)) {
        await productRepository.create({
          ...base,
          id,
          title: `Private title ${name}`,
          slug: `library-${name}-${suffix}`,
          status: name === "draft" ? "draft" : "published",
          price: name === "paid" ? 2500 : 0,
        });
        if (name !== "unsafe") {
          const buildId = `bld_lib_${name}_${suffix}`;
          buildIds.push(buildId);
          await buildRepository.create({
            id: buildId,
            productId: id,
            version: "1.0.0",
            status: "published",
            storageKey: `assets/test/library-${name}-${suffix}.zip`,
            sha256Hash: "a".repeat(64),
            fileSizeBytes: 16,
            fileName: "library-fixture.zip",
            mimeType: "application/zip",
            scanStatus: "clean",
            scanner: "integration-fixture",
            scannedAt: new Date(),
            isSigned: false,
          });
        }
      }

      const now = new Date();
      // The product's denormalized currentVersion can be stale. Only safe
      // published builds may become the default download's displayed version.
      const latestReadyId = `bld_lib_ready_released_${suffix}`;
      const unsafeNewerId = `bld_lib_ready_unsafe_${suffix}`;
      buildIds.push(latestReadyId, unsafeNewerId);
      const buildBase = {
        productId: productIds.ready,
        fileSizeBytes: 16,
        fileName: "library-fixture.zip",
        mimeType: "application/zip",
        sha256Hash: "a".repeat(64),
        isSigned: false,
      };
      await db.insert(builds).values([
        {
          ...buildBase,
          id: latestReadyId,
          version: "1.4.0",
          status: "published",
          storageKey: `assets/test/library-safe-release-${suffix}.zip`,
          scanStatus: "clean",
          scanner: "integration-fixture",
          scannedAt: now,
          createdAt: new Date(now.getTime() + 60_000),
        },
        {
          ...buildBase,
          id: unsafeNewerId,
          version: "9.9.0",
          // Non-published: published requires scan_status=clean (builds_published_safe_check).
          status: "rejected",
          storageKey: `assets/test/library-unsafe-release-${suffix}.zip`,
          scanStatus: "error",
          createdAt: new Date(now.getTime() + 120_000),
        },
      ]);
      await db
        .update(products)
        .set({ currentVersion: "99.0.0" })
        .where(eq(products.id, productIds.ready));
      await db.insert(entitlements).values([
        {
          id: entitlementIds[0],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.download",
          resourceId: productIds.ready,
          createdAt: new Date(now.getTime() - 50_000),
        },
        {
          id: entitlementIds[1],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.download",
          resourceId: productIds.ready,
          createdAt: now,
        },
        {
          id: entitlementIds[2],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.download",
          resourceId: productIds.unsafe,
        },
        {
          id: entitlementIds[3],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.download",
          resourceId: productIds.draft,
        },
        {
          id: entitlementIds[4],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.download",
          resourceId: productIds.expired,
          expiresAt: new Date(now.getTime() - 60_000),
        },
        {
          id: entitlementIds[5],
          subjectType: "user",
          subjectId: ownerId,
          permission: "product.update",
          resourceId: productIds.other,
        },
        {
          id: entitlementIds[6],
          subjectType: "user",
          subjectId: outsiderId,
          permission: "product.download",
          resourceId: productIds.other,
        },
      ]);
      await db.insert(licenses).values([
        {
          id: licenseIds[0],
          key: `LIB-PAID-SECRET-${suffix}`,
          productId: productIds.paid,
          userId: ownerId,
          status: "active",
          model: "single_server",
          entitlements: [],
        },
        {
          id: licenseIds[1],
          key: `LIB-REVOKED-SECRET-${suffix}`,
          productId: productIds.revoked,
          userId: ownerId,
          status: "revoked",
          model: "single_server",
          entitlements: ["product.download"],
        },
        {
          id: licenseIds[2],
          key: `LIB-EXPIRED-SECRET-${suffix}`,
          productId: productIds.expired,
          userId: ownerId,
          status: "active",
          model: "single_server",
          expiresAt: new Date(now.getTime() - 60_000),
          entitlements: ["product.download"],
        },
      ]);

      const owner = await userLibraryRepository.pageByUser(ownerId);
      expect(owner.counts).toEqual({ all: 4, ready: 2, unavailable: 2 });
      expect(owner.total).toBe(4);
      expect(owner.items).toHaveLength(4);
      expect(new Set(owner.items.map((row) => row.resourceId)).size).toBe(4);
      expect(owner.items.find((row) => row.resourceId === productIds.ready)).toMatchObject({
        title: "Private title ready",
        downloadable: true,
        version: "1.4.0",
      });
      expect((await buildRepository.findLatestPublishedByProduct(productIds.ready))?.id).toBe(
        latestReadyId,
      );
      expect(owner.items.find((row) => row.resourceId === productIds.paid)).toMatchObject({
        title: "Private title paid",
        downloadable: true,
      });
      for (const name of ["draft", "unsafe"] as const) {
        const row = owner.items.find((item) => item.resourceId === productIds[name]);
        expect(row).toMatchObject({
          title: null,
          slug: null,
          version: null,
          downloadable: false,
        });
      }
      for (const name of ["other", "expired", "revoked"] as const) {
        expect(owner.items.some((row) => row.resourceId === productIds[name])).toBe(false);
      }

      const ready = await userLibraryRepository.pageByUser(ownerId, 1, "ready", 1);
      expect(ready).toMatchObject({ total: 2, pageSize: 1, totalPages: 2 });
      expect(ready.items).toHaveLength(1);
      expect(ready.items[0]?.downloadable).toBe(true);
      const second = await userLibraryRepository.pageByUser(ownerId, 2, "ready", 1);
      expect(second.items).toHaveLength(1);
      expect(second.items[0]?.resourceId).not.toBe(ready.items[0]?.resourceId);
      const missing = await userLibraryRepository.pageByUser(ownerId, 99, "unavailable", 12);
      expect(missing).toMatchObject({ total: 2, page: 1, totalPages: 1 });
      expect(missing.items.every((row) => row.downloadable === false)).toBe(true);

      const outsider = await userLibraryRepository.pageByUser(outsiderId);
      expect(outsider.counts).toEqual({ all: 1, ready: 1, unavailable: 0 });
      expect(outsider.items.map((row) => row.resourceId)).toEqual([productIds.other]);
      expect((await userLibraryRepository.pageByUser(authorId)).total).toBe(0);
      expect(
        await entitlementRepository.hasEntitlement(
          { type: "user", id: ownerId },
          productIds.revoked,
          "product.download",
        ),
      ).toBe(false);
      expect(
        await entitlementRepository.hasEntitlement(
          { type: "user", id: ownerId },
          productIds.paid,
          "product.download",
        ),
      ).toBe(true);
      expect((await licenseRepository.pageUserHistory(ownerId)).total).toBe(3);

      const currentToken = `library-selection-token-${suffix}`;
      await sessionRepository.create({
        id: `ses_lib_selection_${suffix}`,
        userId: ownerId,
        token: currentToken,
        expiresAt: new Date(Date.now() + 3600000),
      });
      const oldBuildId = `bld_lib_ready_${suffix}`;
      const selectInput = {
        userId: ownerId,
        currentToken,
        productId: productIds.ready,
        auditId: `aud_lib_select_${suffix}`,
        command: { mode: "fixed" as const, buildId: oldBuildId, expectedRevision: 0 },
      };
      const selected = await resourceLibrarySelectionsRepository.command(selectInput);
      expect(selected.selection).toMatchObject({ revision: 1, mode: "fixed", buildId: oldBuildId });
      expect(
        (await userLibraryRepository.pageByUser(ownerId)).items.find(
          (row) => row.resourceId === productIds.ready,
        ),
      ).toMatchObject({
        version: "1.0.0",
        buildId: oldBuildId,
        selectionMode: "fixed",
        downloadable: true,
      });
      expect(
        (await resourceLibrarySelectionsRepository.page(ownerId, 1, "updates")).items.map(
          (row) => row.productId,
        ),
      ).toContain(productIds.ready);
      expect(
        (await resourceLibrarySelectionsRepository.command(selectInput)).selection.revision,
      ).toBe(1);
      const races = await Promise.allSettled([
        resourceLibrarySelectionsRepository.command({
          ...selectInput,
          auditId: `aud_lib_race_1_${suffix}`,
          command: { mode: "latest", expectedRevision: 1 },
        }),
        resourceLibrarySelectionsRepository.command({
          ...selectInput,
          auditId: `aud_lib_race_2_${suffix}`,
          command: { mode: "fixed", buildId: latestReadyId, expectedRevision: 1 },
        }),
      ]);
      expect(races.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(races.filter((result) => result.status === "rejected")).toHaveLength(1);
      const current = await resourceLibrarySelectionsRepository.detail(ownerId, productIds.ready);
      const pin = await resourceLibrarySelectionsRepository.command({
        ...selectInput,
        auditId: `aud_lib_pin_${suffix}`,
        command: {
          mode: "fixed",
          buildId: oldBuildId,
          expectedRevision: current.selection.revision,
        },
      });
      await db
        .update(builds)
        .set({
          status: "quarantined",
          quarantinePreviousStatus: "published",
          quarantineReason: "Fixture quarantine",
          quarantinedAt: new Date(),
        })
        .where(eq(builds.id, oldBuildId));
      expect(
        (await userLibraryRepository.pageByUser(ownerId)).items.find(
          (row) => row.resourceId === productIds.ready,
        ),
      ).toMatchObject({ downloadable: false, buildId: null, version: null });
      expect(
        (await resourceLibrarySelectionsRepository.detail(ownerId, productIds.ready)).selected,
      ).toBeNull();
      await expect(
        resourceLibrarySelectionsRepository.command({
          ...selectInput,
          command: { ...selectInput.command, expectedRevision: pin.selection.revision },
        }),
      ).rejects.toMatchObject({ code: "LIBRARY_RELEASE_UNAVAILABLE" });
      await db.delete(entitlements).where(inArray(entitlements.id, entitlementIds.slice(0, 2)));
      await expect(
        resourceLibrarySelectionsRepository.detail(ownerId, productIds.ready),
      ).rejects.toMatchObject({ statusCode: 404 });
      // Saved preferences neither mint a license nor alter existing financial/access records.
      expect((await licenseRepository.pageUserHistory(ownerId)).total).toBe(3);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, ownerId));
      await db.delete(licenses).where(inArray(licenses.id, licenseIds));
      await db.delete(entitlements).where(inArray(entitlements.id, entitlementIds));
      await db.delete(builds).where(inArray(builds.id, buildIds));
      await db.delete(products).where(inArray(products.id, ids));
      await db.delete(users).where(inArray(users.id, actors));
    }
  });
});
