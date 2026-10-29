import { randomBytes, randomUUID } from "node:crypto";
import {
  auditEvents,
  buildRepository,
  builds,
  db,
  entitlements,
  libraryCollectionsRepository,
  librarySelectionBatchesRepository,
  librarySelectionBatchReceipts,
  notifications,
  products,
  resourceReleaseEvents as releaseEvents,
  resourceReleaseWatches as releaseWatches,
  resourceRequirementsRepository as repo,
  resourceLibrarySelectionsRepository,
  resourceReleaseWatchesRepository,
  resourceLibrarySelections as selections,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";
import { resourceReleaseWorkerRepository } from "../packages/db/src/repositories/resource-release-worker";
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
  await sessionRepository.create({
    id: `ses_${buyer}`,
    userId: buyer,
    token: `tok_${buyer}`,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await sessionRepository.create({
    id: `ses_${staff}`,
    userId: staff,
    token: `tok_${staff}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
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
        `tok_${staff}`,
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
      `tok_${staff}`,
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
    currentToken: `tok_${f.buyer}`,
    command: { action: "create", name: "Batch fixture", requestId: randomUUID() },
    newCollectionId: collectionId,
    receiptId: `lcr_req_${f.key}_0`,
    auditId: `aud_req_col_${f.key}_0`,
  });
  for (let i = 0; i < 2; i++)
    await libraryCollectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
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
      currentToken: `tok_${f.buyer}`,
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
it("release comparison observes two exact published artifacts without exposing private package evidence", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const report = await resourceLibrarySelectionsRepository.compare(f.buyer, rootId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 2,
    });
    expect(report).toMatchObject({
      artifactState: "same",
      returnPage: 2,
      metadataChanges: { version: true },
      from: { version: "1.0.0" },
      to: { version: "2.0.0" },
    });
    expect(report.from.packageSummary).not.toBeNull();
    expect(JSON.stringify(report)).not.toMatch(
      /storageKey|packageEvidence|aclRights|referencesTruncated.*path/u,
    );
  } finally {
    await f.cleanup();
  }
});
it("release comparison rejects revoked rights, withdrawn artifacts and foreign releases", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const query = { from: `bld_req_${f.key}_0`, to: `bld_req_${f.key}_replacement`, returnPage: 1 };
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, {
        ...query,
        to: `bld_req_${f.key}_1`,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db.update(builds).set({ status: "deprecated" }).where(eq(builds.id, query.from));
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, query),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceLibrarySelectionsRepository.compare(f.buyer, rootId, query),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});
it("publisher and staff roles do not confer buyer comparison access", async () => {
  const f = await fixture();
  try {
    const rootId = f.ids[0];
    if (!rootId) throw new Error("Missing resource");
    await f.publishReplacement();
    const query = { from: `bld_req_${f.key}_0`, to: `bld_req_${f.key}_replacement`, returnPage: 1 };
    for (const actorId of [f.owner, f.staff])
      await expect(
        resourceLibrarySelectionsRepository.compare(actorId, rootId, query),
      ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});

it("replays a lost single-selection response once without another audit", async () => {
  const f = await fixture();
  try {
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      command: { mode: "fixed" as const, buildId: `bld_req_${f.key}_0`, expectedRevision: 0 },
      auditId: `aud_single_${f.key}`,
    };
    const first = await resourceLibrarySelectionsRepository.command(input);
    const retry = await resourceLibrarySelectionsRepository.command({
      ...input,
      auditId: `aud_retry_${f.key}`,
    });
    expect(retry).toEqual(first);
    expect(first.selection.revision).toBe(1);
    const events = await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.actorId, f.buyer), eq(auditEvents.action, "library.release_selected")),
      );
    expect(events).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("serializes competing single selections so one revision cannot overwrite another", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const outcomes = await Promise.allSettled(
      [`bld_req_${f.key}_0`, `bld_req_${f.key}_replacement`].map((buildId, index) =>
        resourceLibrarySelectionsRepository.command({
          userId: f.buyer,
          currentToken: `tok_${f.buyer}`,
          productId: f.ids[0] ?? "",
          command: { mode: "fixed", buildId, expectedRevision: 0 },
          auditId: `aud_race_${f.key}_${index}`,
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((r) => r.status === "rejected");
    expect(rejected && rejected.status === "rejected" ? rejected.reason : null).toMatchObject({
      code: "LIBRARY_RELEASE_CONFLICT",
    });
    const rows = await db.select().from(selections).where(eq(selections.userId, f.buyer));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revision).toBe(1);
  } finally {
    await f.cleanup();
  }
});
it("rolls a single selection back if its mandatory audit cannot be written", async () => {
  const f = await fixture();
  try {
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId: f.ids[0] ?? "",
        command: { mode: "fixed", buildId: `bld_req_${f.key}_0`, expectedRevision: 0 },
        auditId: `aud_req_${f.key}_0`,
      }),
    ).rejects.toThrow();
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
  } finally {
    await f.cleanup();
  }
});

it("selects the exact comparison target with its observed preference revision and archive identity", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const productId = f.ids[0] ?? "";
    const comparison = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 1,
    });
    expect(comparison.selection).toEqual({ revision: 0, mode: "latest", buildId: null });
    const command = {
      mode: "fixed" as const,
      buildId: comparison.to.id,
      expectedRevision: comparison.selection.revision,
      reviewedArtifact: {
        sha256Hash: comparison.to.sha256Hash,
        fileSizeBytes: comparison.to.fileSizeBytes,
      },
    };
    const selected = await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command,
      auditId: `aud_compared_${f.key}`,
    });
    expect(selected.selection).toMatchObject({
      mode: "fixed",
      revision: 1,
      buildId: comparison.to.id,
    });
    const replay = await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command,
      auditId: `aud_compared_retry_${f.key}`,
    });
    expect(replay).toEqual(selected);
    const snapshot = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: comparison.from.id,
      to: comparison.to.id,
      returnPage: 1,
    });
    expect(snapshot.selection).toEqual({ revision: 1, mode: "fixed", buildId: comparison.to.id });
  } finally {
    await f.cleanup();
  }
});
it("rejects a comparison choice after an intervening selection or revoked access", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const productId = f.ids[0] ?? "";
    const comparison = await resourceLibrarySelectionsRepository.compare(f.buyer, productId, {
      from: `bld_req_${f.key}_0`,
      to: `bld_req_${f.key}_replacement`,
      returnPage: 1,
    });
    const command = {
      mode: "fixed" as const,
      buildId: comparison.to.id,
      expectedRevision: comparison.selection.revision,
      reviewedArtifact: {
        sha256Hash: comparison.to.sha256Hash,
        fileSizeBytes: comparison.to.fileSizeBytes,
      },
    };
    await resourceLibrarySelectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId,
      command: { mode: "fixed", buildId: comparison.from.id, expectedRevision: 0 },
      auditId: `aud_intervening_${f.key}`,
    });
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId,
        command,
        auditId: `aud_stale_review_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "LIBRARY_RELEASE_CONFLICT" });
    expect(
      (await db.select().from(selections).where(eq(selections.userId, f.buyer)))[0]?.buildId,
    ).toBe(comparison.from.id);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceLibrarySelectionsRepository.command({
        userId: f.buyer,
        currentToken: `tok_${f.buyer}`,
        productId,
        command: { ...command, expectedRevision: 1 },
        auditId: `aud_revoked_review_${f.key}`,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  } finally {
    await f.cleanup();
  }
});

it("previews a candidate release while preserving root and dependency selections and audits", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    await f.publishReplacement();
    const before = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const audits = await db
      .select({ id: auditEvents.id })
      .from(auditEvents)
      .where(eq(auditEvents.actorId, f.buyer))
      .orderBy(auditEvents.id);
    const productId = f.ids[0] ?? "",
      previewBuildId = `bld_req_${f.key}_replacement`;
    const current = await repo.report({
      actorId: f.buyer,
      productId,
      scope: "library",
      targetMta: "1.6.0",
    });
    expect(current.nodes.find((node) => node.id === productId)?.build?.id).toBe(
      `bld_req_${f.key}_0`,
    );
    const preview = await repo.report({
      actorId: f.buyer,
      productId,
      scope: "library",
      targetMta: "1.6.0",
      previewBuildId,
    });
    expect(preview.previewBuildId).toBe(previewBuildId);
    expect(preview.nodes.find((node) => node.id === productId)).toMatchObject({
      selection: "preview",
      build: { id: previewBuildId },
    });
    expect(preview.nodes.find((node) => node.id === f.ids[1])).toMatchObject({
      selection: "fixed",
      build: { id: `bld_req_${f.key}_1` },
    });
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(before);
    expect(
      await db
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(eq(auditEvents.actorId, f.buyer))
        .orderBy(auditEvents.id),
    ).toEqual(audits);
    expect(JSON.stringify(preview)).not.toContain("fixture/req_");
  } finally {
    await f.cleanup();
  }
});
it("does not preview a foreign or withdrawn release or reuse a revoked buyer grant", async () => {
  const f = await fixture();
  try {
    await f.publishReplacement();
    const query = {
      actorId: f.buyer,
      productId: f.ids[0] ?? "",
      scope: "library" as const,
      targetMta: "1.6.0",
      previewBuildId: `bld_req_${f.key}_replacement`,
    };
    await expect(
      repo.report({ ...query, previewBuildId: `bld_req_${f.key}_1` }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await db
      .update(builds)
      .set({ status: "deprecated" })
      .where(eq(builds.id, query.previewBuildId));
    await expect(repo.report(query)).rejects.toMatchObject({ statusCode: 404 });
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      repo.report({ ...query, previewBuildId: `bld_req_${f.key}_0` }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(await db.select().from(selections).where(eq(selections.userId, f.buyer))).toHaveLength(
      0,
    );
  } finally {
    await f.cleanup();
  }
});

it("enrolls collection resources from the current release baseline without changing pinned versions and confirms retries once", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    const preferences = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const items = f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 }));
    const command = { expectedCollectionRevision: 3, items };
    const result = await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_watch_col_${f.key}`,
    });
    expect(result.changedCount).toBe(2);
    const retry = await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_watch_retry_${f.key}`,
    });
    expect(retry.changedCount).toBe(0);
    expect(retry.items).toEqual(result.items);
    const watches = await db
      .select()
      .from(releaseWatches)
      .where(eq(releaseWatches.userId, f.buyer));
    const events = await db
      .select()
      .from(releaseEvents)
      .where(inArray(releaseEvents.productId, f.ids.slice(0, 2)));
    for (const watch of watches)
      expect(watch.lastSequence).toBe(
        events.find((event) => event.productId === watch.productId)?.sequence,
      );
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(preferences);
    expect(
      await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.actorId, f.buyer),
            eq(auditEvents.action, "library.collection_release_watches_enabled"),
          ),
        ),
    ).toHaveLength(1);
  } finally {
    await f.cleanup();
  }
});
it("rolls collection enrollment back on audit failure and rejects revoked grants or stale membership", async () => {
  const f = await batchFixture();
  try {
    const command = {
      expectedCollectionRevision: 3,
      items: f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 })),
    };
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_req_${f.key}_0`,
    };
    await expect(resourceReleaseWatchesRepository.enableCollectionBatch(input)).rejects.toThrow();
    expect(
      await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer)),
    ).toHaveLength(0);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    await expect(
      resourceReleaseWatchesRepository.enableCollectionBatch({
        ...input,
        auditId: `aud_revoked_watch_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
    await libraryCollectionsRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command: {
        action: "remove",
        productId: f.ids[1] ?? "",
        expectedRevision: 3,
        requestId: randomUUID(),
      },
      newCollectionId: f.collectionId,
      receiptId: `lcr_watch_remove_${f.key}`,
      auditId: `aud_watch_remove_${f.key}`,
    });
    await expect(
      resourceReleaseWatchesRepository.enableCollectionBatch({
        ...input,
        auditId: `aud_stale_watch_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_COLLECTION_CONFLICT" });
    expect(
      await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer)),
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});

it("projects collection enrollment and batch stopping as own watch operations while masking titles after access loss", async () => {
  const f = await batchFixture();
  try {
    const command = {
      expectedCollectionRevision: 3,
      items: f.ids.slice(0, 2).map((productId) => ({ productId, expectedRevision: 0 })),
    };
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      command,
      auditId: `aud_hist_watch_enable_${f.key}`,
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      command: { items: command.items.map((item) => ({ ...item, expectedRevision: 1 })) },
      auditId: `aud_hist_watch_stop_${f.key}`,
    });
    const query = { days: 7 as const, page: 1, source: "all" as const, productId: f.ids[0] };
    const report = await resourceReleaseWatchesRepository.history(f.buyer, query);
    expect(report.total).toBe(2);
    expect(report.items.every((item) => item.changes?.length === 2)).toBe(true);
    expect(
      report.items.some(
        (item) => item.source === "collection" && item.changes?.every((change) => change.enabled),
      ),
    ).toBe(true);
    await db.delete(entitlements).where(eq(entitlements.subjectId, f.buyer));
    const masked = await resourceReleaseWatchesRepository.history(f.buyer, query);
    expect(masked.total).toBe(2);
    expect(
      masked.items
        .flatMap((item) => item.changes ?? [])
        .every((change) => change.currentTitle === null && !change.currentAvailable),
    ).toBe(true);
    expect(
      (await resourceReleaseWatchesRepository.history(f.staff, { days: 7, page: 1, source: "all" }))
        .items,
    ).toHaveLength(0);
  } finally {
    await f.cleanup();
  }
});
it("keeps malformed watch audit details neutral instead of exposing raw fields or inferred state", async () => {
  const f = await fixture();
  try {
    await db.insert(auditEvents).values({
      id: `aud_bad_watch_${f.key}`,
      actorId: f.buyer,
      actorType: "user",
      action: "library.release_watch_changed",
      targetType: "product",
      targetId: f.ids[0] ?? "",
      details: { enabled: "false", revision: 1, private: "DO-NOT-EXPORT", lastSequence: "999" },
    });
    const report = await resourceReleaseWatchesRepository.history(f.buyer, {
      days: 7,
      page: 1,
      source: "individual",
    });
    expect(report.items).toHaveLength(1);
    expect(report.items[0]).toMatchObject({ source: "unknown", changes: null });
    expect(JSON.stringify(report)).not.toContain("DO-NOT-EXPORT");
    expect(JSON.stringify(report)).not.toContain("lastSequence");
  } finally {
    await f.cleanup();
  }
});

it("enrolls and delivers finite-access releases using database time despite application clock skew", async () => {
  const f = await fixture();
  let clock: ReturnType<typeof vi.spyOn> | undefined;
  try {
    await db
      .update(entitlements)
      .set({ expiresAt: sql`clock_timestamp()+interval '10 minutes'` })
      .where(eq(entitlements.subjectId, f.buyer));
    await db
      .update(sessions)
      .set({ expiresAt: new Date("2099-01-01T00:00:00Z") })
      .where(inArray(sessions.userId, [f.staff, f.buyer]));
    clock = vi.spyOn(Date, "now").mockReturnValue(new Date("2036-01-01T00:00:00Z").getTime());
    const start = await resourceReleaseWatchesRepository.command({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      command: { enabled: true, expectedRevision: 0 },
      auditId: `aud_watch_clock_${f.key}`,
    });
    expect(start).toMatchObject({ enabled: true, revision: 1 });
    await f.publishReplacement();
    await resourceReleaseWorkerRepository.runBatch(100);
    const inbox = await db
      .select()
      .from(notifications)
      .where(eq(notifications.recipientId, f.buyer));
    expect(
      inbox.filter((row) => (row.data as { kind?: string } | null)?.kind === "resource_release"),
    ).toHaveLength(1);
    expect(await resourceReleaseWatchesRepository.detail(f.buyer, f.ids[0] ?? "")).toMatchObject({
      enabled: true,
      revision: 1,
    });
  } finally {
    clock?.mockRestore();
    await db.delete(auditEvents).where(eq(auditEvents.targetId, `${f.buyer}:${f.ids[0]}`));
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});
it("rolls back an individual watch on audit failure and preserves monotonic update times on retry", async () => {
  const f = await fixture();
  try {
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      productId: f.ids[0] ?? "",
      auditId: `aud_watch_atomic_${f.key}`,
    };
    await resourceReleaseWatchesRepository.command({
      ...input,
      command: { enabled: true, expectedRevision: 0 },
    });
    await db
      .update(releaseWatches)
      .set({ updatedAt: sql`clock_timestamp()+interval '1 hour'` })
      .where(eq(releaseWatches.userId, f.buyer));
    const before = await resourceReleaseWatchesRepository.detail(f.buyer, input.productId);
    await expect(
      resourceReleaseWatchesRepository.command({
        ...input,
        command: { enabled: false, expectedRevision: 1 },
      }),
    ).rejects.toThrow();
    expect(await resourceReleaseWatchesRepository.detail(f.buyer, input.productId)).toEqual(before);
    const stop = {
      ...input,
      auditId: `aud_watch_atomic_stop_${f.key}`,
      command: { enabled: false, expectedRevision: 1 },
    };
    const saved = await resourceReleaseWatchesRepository.command(stop);
    expect(saved.updatedAt.getTime()).toBeGreaterThan(before.updatedAt?.getTime() ?? 0);
    expect(
      await resourceReleaseWatchesRepository.command({
        ...stop,
        auditId: `aud_watch_atomic_retry_${f.key}`,
      }),
    ).toEqual(saved);
    const audits = await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorId, f.buyer),
          eq(auditEvents.action, "library.release_watch_changed"),
        ),
      );
    expect(audits).toHaveLength(2);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});

it("resumes reviewed existing watches at current baselines while preserving pins, notices and one audit per operation", async () => {
  const f = await batchFixture();
  try {
    await f.apply();
    const preferenceRows = await db
      .select()
      .from(selections)
      .where(eq(selections.userId, f.buyer))
      .orderBy(selections.productId);
    const ids = f.ids.slice(0, 2);
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      auditId: `aud_resume_enroll_${f.key}`,
      command: {
        expectedCollectionRevision: 3,
        items: ids.map((productId) => ({ productId, expectedRevision: 0 })),
      },
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 1 })) },
    });
    await f.publishReplacement();
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_apply_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 2 })) },
    };
    const result = await resourceReleaseWatchesRepository.resumeBatch(input);
    expect(result.changedCount).toBe(2);
    expect(result.items.every((item) => item.enabled && item.revision === 3)).toBe(true);
    const rows = await db.select().from(releaseWatches).where(eq(releaseWatches.userId, f.buyer));
    const events = await db
      .select()
      .from(releaseEvents)
      .where(inArray(releaseEvents.productId, ids));
    for (const row of rows)
      expect(row.lastSequence).toBe(
        events
          .filter((event) => event.productId === row.productId)
          .reduce((max, event) => (event.sequence > max ? event.sequence : max), 0n),
      );
    expect(
      (
        await resourceReleaseWatchesRepository.resumeBatch({
          ...input,
          auditId: `aud_resume_retry_${f.key}`,
        })
      ).changedCount,
    ).toBe(0);
    const history = await resourceReleaseWatchesRepository.history(f.buyer, {
      page: 1,
      days: 7,
      source: "batch",
    });
    expect(history.total).toBe(2);
    expect(history.items.some((item) => item.changes?.every((change) => change.enabled))).toBe(
      true,
    );
    await resourceReleaseWorkerRepository.runBatch(100);
    expect(
      await db.select().from(notifications).where(eq(notifications.recipientId, f.buyer)),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(selections)
        .where(eq(selections.userId, f.buyer))
        .orderBy(selections.productId),
    ).toEqual(preferenceRows);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});
it("rolls group resumption back on required audit failure and rejects a selected resource after access loss", async () => {
  const f = await batchFixture();
  try {
    const ids = f.ids.slice(0, 2);
    await resourceReleaseWatchesRepository.enableCollectionBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      collectionId: f.collectionId,
      auditId: `aud_resume_atomic_enable_${f.key}`,
      command: {
        expectedCollectionRevision: 3,
        items: ids.map((productId) => ({ productId, expectedRevision: 0 })),
      },
    });
    await resourceReleaseWatchesRepository.disableBatch({
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_atomic_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 1 })) },
    });
    const before = await db
      .select()
      .from(releaseWatches)
      .where(eq(releaseWatches.userId, f.buyer))
      .orderBy(releaseWatches.productId);
    const input = {
      userId: f.buyer,
      currentToken: `tok_${f.buyer}`,
      auditId: `aud_resume_atomic_stop_${f.key}`,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 2 })) },
    };
    await expect(resourceReleaseWatchesRepository.resumeBatch(input)).rejects.toThrow();
    expect(
      await db
        .select()
        .from(releaseWatches)
        .where(eq(releaseWatches.userId, f.buyer))
        .orderBy(releaseWatches.productId),
    ).toEqual(before);
    await db
      .delete(entitlements)
      .where(and(eq(entitlements.subjectId, f.buyer), eq(entitlements.resourceId, ids[0] ?? "")));
    await expect(
      resourceReleaseWatchesRepository.resumeBatch({
        ...input,
        auditId: `aud_resume_lost_${f.key}`,
      }),
    ).rejects.toMatchObject({ code: "RELEASE_WATCH_UNAVAILABLE" });
    expect(
      await db
        .select()
        .from(releaseWatches)
        .where(eq(releaseWatches.userId, f.buyer))
        .orderBy(releaseWatches.productId),
    ).toEqual(before);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
    await f.cleanup();
  }
});

// Real PostgreSQL guards for the token which initiated each watch mutation.
type WatchMode = "single" | "collection" | "resume" | "stop";
type WatchFixture = Awaited<ReturnType<typeof batchFixture>>;
type WatchTx = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function watchCommand(f: WatchFixture, mode: WatchMode) {
  const input = { userId: f.buyer, currentToken: `tok_${f.buyer}` };
  const ids = f.ids.slice(0, 2);
  const enable = {
    ...input,
    collectionId: f.collectionId,
    command: {
      expectedCollectionRevision: 3,
      items: ids.map((productId) => ({ productId, expectedRevision: 0 })),
    },
    auditId: `aud_guard_enroll_${f.key}`,
  };
  if (mode === "resume" || mode === "stop")
    await resourceReleaseWatchesRepository.enableCollectionBatch(enable);
  if (mode === "resume")
    await resourceReleaseWatchesRepository.disableBatch({
      ...input,
      command: { items: ids.map((productId) => ({ productId, expectedRevision: 1 })) },
      auditId: `aud_guard_stop_${f.key}`,
    });
  return (currentToken = input.currentToken) => {
    const actor = { ...input, currentToken, auditId: `aud_guard_apply_${f.key}` };
    if (mode === "single")
      return resourceReleaseWatchesRepository.command({
        ...actor,
        productId: ids[0] ?? "",
        command: { enabled: true, expectedRevision: 0 },
      });
    if (mode === "collection")
      return resourceReleaseWatchesRepository.enableCollectionBatch({ ...enable, ...actor });
    const command = {
      items: ids.map((productId) => ({ productId, expectedRevision: mode === "resume" ? 2 : 1 })),
    };
    return mode === "resume"
      ? resourceReleaseWatchesRepository.resumeBatch({ ...actor, command })
      : resourceReleaseWatchesRepository.disableBatch({ ...actor, command });
  };
}
async function watchState(f: WatchFixture) {
  return {
    watches: await db
      .select()
      .from(releaseWatches)
      .where(eq(releaseWatches.userId, f.buyer))
      .orderBy(releaseWatches.productId),
    audits: await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorId, f.buyer))
      .orderBy(auditEvents.id),
  };
}
it.each<WatchMode>(["single", "collection", "resume", "stop"])(
  "%s watch mutations and complete replays require the live initiating token",
  async (mode) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode);
      const expired = `tok_expired_${f.key}`,
        revoked = `tok_revoked_${f.key}`,
        rotated = `tok_rotated_${f.key}`;
      for (const [name, token, expiresAt] of [
        ["expired", expired, new Date(Date.now() - 60000)],
        ["revoked", revoked, new Date(Date.now() + 3600000)],
        ["rotated", rotated, new Date(Date.now() + 3600000)],
      ] as const)
        await sessionRepository.create({
          id: `ses_${name}_${f.key}`,
          userId: f.buyer,
          token,
          expiresAt,
        });
      await db.delete(sessions).where(eq(sessions.id, `ses_revoked_${f.key}`));
      await db
        .update(sessions)
        .set({ token: `replacement_${f.key}` })
        .where(eq(sessions.id, `ses_rotated_${f.key}`));
      for (const replay of [false, true]) {
        if (replay) await mutate();
        const before = await watchState(f);
        for (const token of ["", `missing_${f.key}`, `tok_${f.staff}`, expired, revoked, rotated]) {
          await expect(mutate(token)).rejects.toMatchObject({ statusCode: 401 });
          expect(await watchState(f)).toEqual(before);
        }
        if (replay) {
          await mutate();
          expect(await watchState(f)).toEqual(before);
        }
      }
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
);
async function watchAfterWait(
  hold: (tx: WatchTx) => Promise<unknown>,
  mutate: () => Promise<unknown>,
  invalidate: (tx: WatchTx) => Promise<unknown>,
) {
  let pending: Promise<{ ok: true; value: unknown } | { ok: false; error: unknown }> | undefined;
  let completed = false;
  try {
    await db.transaction(async (tx) => {
      await hold(tx);
      const [blocker] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() AS pid`);
      pending = mutate()
        .then(
          (value) => ({ ok: true as const, value }),
          (error: unknown) => ({ ok: false as const, error }),
        )
        .then((result) => {
          completed = true;
          return result;
        });
      const deadline = Date.now() + 3000;
      for (;;) {
        expect(completed, "watch command must wait for the held authority lock").toBe(false);
        const [waiting] = await db.execute<{ blocked: boolean }>(
          sql`select exists(select 1 from pg_stat_activity where ${blocker?.pid}::int=any(pg_blocking_pids(pid))) AS blocked`,
        );
        if (waiting?.blocked) break;
        if (Date.now() >= deadline) throw new Error("Expected watch lock wait was not observed");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      await invalidate(tx);
    });
  } finally {
    if (pending) await pending;
  }
  if (!pending) throw new Error("Watch operation was not started");
  return pending;
}
it.each([
  ["single", "account"],
  ["single", "product"],
  ["single", "grant"],
  ["collection", "advisory"],
  ["collection", "membership"],
  ["stop", "watch"],
  ["resume", "session"],
] as const)(
  "%s rechecks a revoked initiator after a real %s lock wait without partial writes",
  async (mode, lock) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode),
        before = await watchState(f);
      const outcome = await watchAfterWait(
        async (tx) => {
          if (lock === "account")
            return tx.select().from(users).where(eq(users.id, f.buyer)).for("update");
          if (lock === "product")
            return tx
              .select()
              .from(products)
              .where(eq(products.id, f.ids[0] ?? ""))
              .for("update");
          if (lock === "grant")
            return tx
              .select()
              .from(entitlements)
              .where(eq(entitlements.subjectId, f.buyer))
              .for("update");
          if (lock === "advisory")
            return tx.execute(
              sql`select pg_advisory_xact_lock(hashtext(${`library-collections:${f.buyer}`}))`,
            );
          if (lock === "membership")
            return tx.execute(
              sql`select 1 from library_collection_items where collection_id=${f.collectionId} for update`,
            );
          if (lock === "watch")
            return tx
              .select()
              .from(releaseWatches)
              .where(eq(releaseWatches.userId, f.buyer))
              .for("update");
          return tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, `ses_${f.buyer}`))
            .for("update");
        },
        mutate,
        (tx) => tx.delete(sessions).where(eq(sessions.id, `ses_${f.buyer}`)),
      );
      expect(outcome).toMatchObject({ ok: false, error: { statusCode: 401 } });
      expect(await watchState(f)).toEqual(before);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
  10000,
);
it.each([
  ["single", false],
  ["single", true],
  ["collection", false],
  ["collection", true],
  ["resume", false],
  ["resume", true],
] as const)(
  "%s rejects finite access that expires during the final session wait (replay=%s)",
  async (mode, replay) => {
    const f = await batchFixture();
    try {
      const mutate = await watchCommand(f, mode);
      if (replay) await mutate();
      const before = await watchState(f);
      await db
        .update(entitlements)
        .set({ expiresAt: sql`clock_timestamp()+interval '600 milliseconds'` })
        .where(eq(entitlements.subjectId, f.buyer));
      const outcome = await watchAfterWait(
        async (tx) => {
          await tx
            .select()
            .from(sessions)
            .where(eq(sessions.id, `ses_${f.buyer}`))
            .for("update");
        },
        mutate,
        (tx) => tx.execute(sql`select pg_sleep(0.7)`),
      );
      expect(outcome).toMatchObject({
        ok: false,
        error: mode === "single" ? { statusCode: 404 } : { code: "RELEASE_WATCH_UNAVAILABLE" },
      });
      expect(await watchState(f)).toEqual(before);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, f.buyer));
      await f.cleanup();
    }
  },
  10000,
);
