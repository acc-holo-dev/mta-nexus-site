import { randomBytes, randomUUID } from "node:crypto";
import {
  libraryCollectionsRepository,
  librarySelectionBatchesRepository,
  librarySelectionBatchReceipts,
  resourceLibrarySelectionsRepository,
  buildRepository,
  builds,
  db,
  entitlements,
  products,
  resourceRequirementsRepository as repo,
  resourceLibrarySelections as selections,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray } from "drizzle-orm";
import { expect, it } from "vitest";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";
import archives from "./fixtures/build-packages.json";

// Requires a disposable PostgreSQL database migrated through 0061. No storage writes.
async function fixture(privateDependency = false) {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_req_owner_${key}`,
    buyer = `usr_req_buyer_${key}`,
    staff = `usr_req_staff_${key}`;
  for (const [id, role] of [
    [owner, "developer"],
    [buyer, "user"],
    [staff, "moderator"],
  ] as const)
    await userRepository.create({
      id,
      role,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
    });
  const ids = [`prd_req_root_${key}`, `prd_req_dep_${key}`, `prd_req_hidden_${key}`],
    slugs = ids.map((id) => id.replaceAll("_", "-"));
  const evidence = await inspectBuildPackage({
    bytes: Buffer.from(archives.stored, "base64"),
    format: "zip",
  });
  for (let index = 0; index < 3; index++) {
    const id = ids[index] ?? "",
      slug = slugs[index] ?? "";
    await db.insert(products).values({
      id,
      slug,
      authorId: owner,
      title: index === 2 ? "Secret unpublished title" : `Requirements ${index}`,
      description: "Requirements fixture",
      type: "script",
      compatibility: {
        mtaMinVersion: "1.6.0",
        dependencies:
          index === 0 ? [slugs[1] ?? ""] : index === 1 && privateDependency ? [slugs[2] ?? ""] : [],
      },
    });
    const build = await buildRepository.submitForReview(
      {
        id: `bld_req_${key}_${index}`,
        productId: id,
        version: "1.0.0",
        status: "pending_review",
        storageKey: `fixture/req_${key}_${index}.zip`,
        sha256Hash: evidence.sha256Hash,
        fileSizeBytes: evidence.fileSizeBytes,
        fileName: "resource.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "integration",
        scannedAt: new Date(),
        isSigned: false,
        packageEvidence: evidence,
      },
      {
        id: `aud_req_${key}_${index}`,
        actorId: owner,
        actorType: "user",
        action: "build.submitted_for_review",
        targetType: "build",
        targetId: `bld_req_${key}_${index}`,
      },
    );
    if (index < 2)
      await buildRepository.moderatePending(
        build.id,
        "approve",
        {
          id: `aud_req_${key}_${index}_approve`,
          actorId: staff,
          actorType: "user",
          action: "build.approved",
          targetType: "build",
          targetId: build.id,
        },
        1,
      );
  }
  await db.insert(entitlements).values({
    id: `ent_req_${key}`,
    subjectType: "user",
    subjectId: buyer,
    permission: "product.download",
    resourceId: ids[0] ?? "",
  });
  async function publishReplacement() {
    const productId = ids[0] ?? "",
      id = `bld_req_${key}_replacement`;
    const build = await buildRepository.submitForReview(
      {
        id,
        productId,
        version: "2.0.0",
        status: "pending_review",
        storageKey: `fixture/req_${key}_replacement.zip`,
        sha256Hash: evidence.sha256Hash,
        fileSizeBytes: evidence.fileSizeBytes,
        fileName: "resource.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "integration",
        scannedAt: new Date(),
        isSigned: false,
        packageEvidence: evidence,
      },
      {
        id: `aud_req_${key}_replacement`,
        actorId: owner,
        actorType: "user",
        action: "build.submitted_for_review",
        targetType: "build",
        targetId: id,
      },
    );
    await buildRepository.moderatePending(
      build.id,
      "approve",
      {
        id: `aud_req_${key}_replacement_approve`,
        actorId: staff,
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: build.id,
      },
      1,
    );
  }
  async function cleanup() {
    await db.delete(entitlements).where(eq(entitlements.subjectId, buyer));
    await db.delete(products).where(inArray(products.id, ids));
    await db.delete(users).where(inArray(users.id, [owner, buyer, staff]));
  }
  const query = {
    actorId: buyer,
    productId: ids[0] ?? "",
    scope: "library" as const,
    targetMta: "1.6.0",
  };
  return { key, ids, slugs, owner, buyer, staff, query, cleanup, publishReplacement };
}
it("reports transitive public declarations and effective root access without minting dependency grants", async () => {
  const f = await fixture();
  try {
    const result = await repo.report(f.query);
    expect(result.nodes).toHaveLength(2);
    expect(result.issues).toContainEqual({ code: "missing_access", slug: f.slugs[1] });
    expect(result.order).toEqual([f.slugs[1], f.slugs[0]]);
    const grants = await db.select().from(entitlements).where(eq(entitlements.subjectId, f.buyer));
    expect(grants).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("does not leak private dependency titles, IDs, builds or further declarations", async () => {
  const f = await fixture(true);
  try {
    const result = await repo.report(f.query);
    expect(result.issues).toContainEqual({ code: "unavailable", slug: f.slugs[2] });
    expect(JSON.stringify(result)).not.toContain("Secret unpublished title");
    expect(result.nodes.some((node) => node.id === f.ids[2])).toBe(false);
  } finally {
    await f.cleanup();
  }
});
it("refuses inaccessible roots and separates publisher/moderator authority", async () => {
  const f = await fixture();
  try {
    await expect(repo.report({ ...f.query, actorId: f.owner })).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(repo.report({ ...f.query, scope: "publisher" })).rejects.toMatchObject({
      statusCode: 404,
    });
    expect((await repo.report({ ...f.query, actorId: f.owner, scope: "publisher" })).scope).toBe(
      "publisher",
    );
    expect((await repo.report({ ...f.query, actorId: f.staff, scope: "moderator" })).scope).toBe(
      "moderator",
    );
  } finally {
    await f.cleanup();
  }
});
it("keeps a withdrawn pinned release unavailable instead of selecting a replacement", async () => {
  const f = await fixture();
  try {
    const buildId = `bld_req_${f.key}_0`;
    await db
      .insert(selections)
      .values({ userId: f.buyer, productId: f.ids[0] ?? "", mode: "fixed", buildId, revision: 1 });
    await f.publishReplacement();
    await db.update(builds).set({ status: "deprecated" }).where(eq(builds.id, buildId));
    const report = await repo.report(f.query);
    expect(report.nodes.find((node) => node.id === f.ids[0])?.build).toBeNull();
    expect(report.issues).toContainEqual({ code: "selection_unavailable", slug: f.slugs[0] });
  } finally {
    await f.cleanup();
  }
});
it("previews an exact unpublished build only within its authorized product", async () => {
  const f = await fixture();
  try {
    const productId = f.ids[2] ?? "",
      buildId = `bld_req_${f.key}_2`;
    const result = await repo.report({
      ...f.query,
      actorId: f.owner,
      productId,
      scope: "publisher",
      buildId,
    });
    expect(result.nodes[0]?.build?.id).toBe(buildId);
    expect(result.issues).toContainEqual({ code: "unsafe_build", slug: f.slugs[2] });
    await expect(
      repo.report({ ...f.query, actorId: f.owner, scope: "publisher", buildId }),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});

// Requires disposable PostgreSQL migrated through 0068. Real locking/rollback,
// not SQL mocks. Existing fixture publication and access policies remain enabled.
async function batchFixture() {
  const f = await fixture();
  await db.insert(entitlements).values({
    id: `ent_req_batch_${f.key}`,
    subjectType: "user",
    subjectId: f.buyer,
    permission: "product.download",
    resourceId: f.ids[1],
  });
  const collectionId = `lcol_req_${f.key}`;
  const creation = await libraryCollectionsRepository.command({
    userId: f.buyer,
    command: { action: "create", name: "Batch fixture", requestId: randomUUID() },
    newCollectionId: collectionId,
    receiptId: `lcr_req_${f.key}_0`,
    auditId: `aud_req_col_${f.key}_0`,
  });
  for (let i = 0; i < 2; i++)
    await libraryCollectionsRepository.command({
      userId: f.buyer,
      collectionId,
      command: {
        action: "add",
        productId: f.ids[i],
        expectedRevision: i + 1,
        requestId: randomUUID(),
      },
      newCollectionId: collectionId,
      receiptId: `lcr_req_${f.key}_${i + 1}`,
      auditId: `aud_req_col_${f.key}_${i + 1}`,
    });
  const choice = { mode: "fixed" as const, productIds: f.ids.slice(0, 2).sort() };
  const preview = await librarySelectionBatchesRepository.preview(
    f.buyer,
    creation.receipt.collection.id,
    choice,
  );
  const command = { ...choice, requestId: randomUUID(), previewDigest: preview.previewDigest };
  const apply = (auditId = `aud_batch_${randomUUID()}`) =>
    librarySelectionBatchesRepository.command({
      userId: f.buyer,
      collectionId,
      command,
      receiptId: `lsbr_${randomUUID()}`,
      auditId,
    });
  return { ...f, collectionId, command, apply };
}
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
