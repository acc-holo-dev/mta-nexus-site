import { expect, it } from "vitest";
import {
  and,
  auditEvents,
  batchFixture,
  builds,
  db,
  entitlements,
  eq,
  libraryCollectionsRepository,
  librarySelectionBatchesRepository,
  librarySelectionBatchReceipts,
  randomUUID,
  resourceLibrarySelectionsRepository,
  selections,
} from "./helpers/resource-requirements-access-harness";

// Requires disposable PostgreSQL migrated through 0068. Real locking/rollback,
// not SQL mocks. Existing fixture publication and access policies remain enabled.
it("applies concurrent duplicate batch confirmations exactly once with immutable history", async () => {
  const f = await batchFixture();
  try {
    const results = await Promise.all([f.apply(), f.apply(), f.apply()]);
    expect(results.filter((r) => !r.replayed)).toHaveLength(1);
    expect(new Set(results.map((r) => r.receipt.id)).size).toBe(1);
    const rows = await db.select().from(selections).where(eq(selections.userId, f.buyer));
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.revision === 1 && r.mode === "fixed")).toBe(true);
    const receipt = results[0].receipt;
    await expect(
      db
        .update(librarySelectionBatchReceipts)
        .set({ snapshot: receipt.snapshot })
        .where(eq(librarySelectionBatchReceipts.id, receipt.id)),
    ).rejects.toThrow();
    await expect(
      db
        .delete(librarySelectionBatchReceipts)
        .where(eq(librarySelectionBatchReceipts.id, receipt.id)),
    ).rejects.toThrow();
    expect(
      (await librarySelectionBatchesRepository.history(f.buyer, f.collectionId)).items,
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("rejects a batch reviewed before an individual selection changed", async () => {
  const f = await batchFixture();
  try {
    await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0],
      command: { mode: "fixed", buildId: `bld_req_${f.key}_0`, expectedRevision: 0 },
      auditId: `aud_single_${f.key}`,
    });
    await expect(f.apply()).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      1,
    );
    expect(
      (await librarySelectionBatchesRepository.history(f.buyer, f.collectionId)).items,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("rolls all selections and receipt back when the mandatory batch audit fails", async () => {
  const f = await batchFixture();
  try {
    await expect(f.apply(`aud_req_${f.key}_0`)).rejects.toThrow();
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
    expect(
      (await librarySelectionBatchesRepository.history(f.buyer, f.collectionId)).items,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("rejects previously reviewed batches after access revocation without making grants", async () => {
  const f = await batchFixture();
  try {
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(f.apply()).rejects.toMatchObject({ code: "SELECTION_BATCH_UNAVAILABLE" });
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
    expect(
      (await librarySelectionBatchesRepository.history(f.buyer, f.collectionId)).items,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("collection release overview distinguishes pinned updates and withdrawn selections", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    await f.publishReplacement();
    const replacement = `bld_req_${f.key}_replacement`;
    const result = await libraryCollectionsRepository.releases(
      f.buyer,
      f.collectionId,
      1,
      "updates",
    );
    expect(result.itemCount).toBe(2);
    expect(result.counts).toMatchObject({ all: 2, updates: 1, pinned: 2, unavailable: 0 });
    expect(result.items[0]).toMatchObject({
      productId: f.ids[0],
      state: "update_available",
      selectedBuildId: `bld_req_${f.key}_0`,
      latestBuildId: replacement,
    });
    await db
      .update(builds)
      .set({ status: "deprecated" })
      .where(eq(builds.id, `bld_req_${f.key}_0`));
    const unavailable = await libraryCollectionsRepository.releases(
      f.buyer,
      f.collectionId,
      1,
      "unavailable",
    );
    expect(unavailable.items[0]).toMatchObject({
      state: "selection_unavailable",
      selectedBuildId: null,
      selectedVersion: null,
      latestBuildId: replacement,
    });
  } finally {
    await f.cleanup();
  }
});
it("collection release overview retains revoked references without exposing build metadata or title searches", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing root resource");
    await db
      .delete(entitlements)
      .where(and(eq(entitlements.subjectId, f.buyer), eq(entitlements.resourceId, rootId)));
    const result = await libraryCollectionsRepository.releases(f.buyer, f.collectionId);
    expect(result.counts).toMatchObject({ all: 2, unavailable: 1 });
    const hidden = result.items.find((item) => item.productId === f.ids[0]);
    expect(hidden).toMatchObject({
      hasAccess: false,
      title: null,
      slug: null,
      state: "unavailable",
      latestBuildId: null,
      latestVersion: null,
      selectedBuildId: null,
      selectedVersion: null,
    });
    const searched = await libraryCollectionsRepository.releases(
      f.buyer,
      f.collectionId,
      1,
      "all",
      "Requirements 0",
    );
    expect(searched.items).toHaveLength(0);
    expect(searched.itemCount).toBe(2);
  } finally {
    await f.cleanup();
  }
});
it("collection release overview permits archived inspection and refuses foreign staff scope", async () => {
  const f = await batchFixture();
  try {
    await libraryCollectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command: { requestId: randomUUID(), action: "archive", expectedRevision: 3 },
      newCollectionId: "unused",
      receiptId: `lcr_arch_${f.key}`,
      auditId: `aud_arch_${f.key}`,
    });
    expect(await libraryCollectionsRepository.releases(f.buyer, f.collectionId)).toMatchObject({
      collection: { status: "archived", revision: 4 },
      itemCount: 2,
    });
    await expect(
      libraryCollectionsRepository.releases(f.staff, f.collectionId),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
it("private selection history combines individual and batch states and survives revoked rights", async () => {
  const f = await batchFixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing root resource");
    await f.apply();
    await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: rootId,
      command: { mode: "latest", expectedRevision: 1 },
      auditId: `aud_individual_${f.key}`,
    });
    const query = { page: 1, days: 7 as const, productId: rootId };
    const report = await resourceLibrarySelectionsRepository.history(f.buyer, query);
    expect(report.total).toBe(2);
    expect(report.items.map((item) => item.source).sort()).toEqual(["batch", "individual"]);
    expect(
      report.items.some(
        (item) => item.selection?.revision === 2 && item.selection.mode === "latest",
      ),
    ).toBe(true);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    const masked = await resourceLibrarySelectionsRepository.history(f.buyer, query);
    expect(masked.total).toBe(2);
    expect(
      masked.items.every(
        (item) =>
          item.currentTitle === null &&
          item.currentSlug === null &&
          item.buildVersion === null &&
          !item.hasCurrentAccess,
      ),
    ).toBe(true);
    expect(masked.items.some((item) => item.selection?.buildId === `bld_req_${f.key}_0`)).toBe(
      true,
    );
  } finally {
    await f.cleanup();
  }
});
it("private selection history does not widen staff inspection to another buyer's choices", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    expect(
      (await resourceLibrarySelectionsRepository.history(f.staff, { page: 1, days: 7 })).items,
    ).toHaveLength(0);
    expect(
      (await resourceLibrarySelectionsRepository.history(f.buyer, { page: 1, days: 7 })).items,
    ).toHaveLength(2);
  } finally {
    await f.cleanup();
  }
});
it("malformed historical details retain a neutral entry without exporting raw private audit data", async () => {
  const f = await batchFixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing root resource");
    await db.insert(auditEvents).values({
      id: `aud_legacy_${f.key}`,
      actorId: f.buyer,
      actorType: "user",
      action: "library.release_selected",
      targetType: "product",
      targetId: rootId,
      ipAddress: "192.0.2.99",
      userAgent: "PRIVATE USER AGENT",
      details: {
        mode: ["fixed"],
        buildId: "bld_private",
        revision: 1,
        privateNote: "PRIVATE DETAILS",
      },
    });
    const report = await resourceLibrarySelectionsRepository.history(f.buyer, { page: 1, days: 7 });
    expect(report.items[0]).toMatchObject({
      selection: null,
      source: "unknown",
      buildVersion: null,
    });
    expect(JSON.stringify(report)).not.toMatch(/PRIVATE|192\.0\.2\.99|bld_private/u);
  } finally {
    await f.cleanup();
  }
});
