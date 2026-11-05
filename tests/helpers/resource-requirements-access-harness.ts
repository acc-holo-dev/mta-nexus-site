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
import { expect } from "vitest";
import { inspectBuildPackage } from "../../apps/web/src/lib/services/build-package-inspection";
import { resourceReleaseWorkerRepository } from "../../packages/db/src/repositories/resource-release-worker";
import archives from "../fixtures/build-packages.json";

export {
  and,
  auditEvents,
  builds,
  db,
  entitlements,
  eq,
  inArray,
  libraryCollectionsRepository,
  librarySelectionBatchesRepository,
  librarySelectionBatchReceipts,
  notifications,
  products,
  randomUUID,
  releaseEvents,
  releaseWatches,
  repo,
  resourceLibrarySelectionsRepository,
  resourceReleaseWatchesRepository,
  resourceReleaseWorkerRepository,
  selections,
  sessionRepository,
  sessions,
  sql,
  users,
};

/** Seed owner/buyer/staff, published root+dependency, and buyer download access. */
export async function fixture(privateDependency = false) {
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
    id: `ses_${owner}`,
    userId: owner,
    token: `tok_${owner}`,
    expiresAt: new Date(Date.now() + 3600000),
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
      `tok_${owner}`,
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
      `tok_${owner}`,
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

/**
 * Extend the base fixture with dependency access, a two-item collection, and a
 * ready batch confirmation. Requires disposable PostgreSQL migrated through 0068.
 */
export async function batchFixture() {
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

export type WatchMode = "single" | "collection" | "resume" | "stop";
export type WatchFixture = Awaited<ReturnType<typeof batchFixture>>;
type WatchTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Prepare a watch mutation for the given mode against the batch fixture. */
export async function watchCommand(f: WatchFixture, mode: WatchMode) {
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

/** Snapshot watch rows and actor audits for equality checks after failed mutations. */
export async function watchState(f: WatchFixture) {
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

/**
 * Hold a lock, start a watch mutation that must wait, invalidate during the wait,
 * then return the mutation outcome without partial writes.
 */
export async function watchAfterWait(
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
