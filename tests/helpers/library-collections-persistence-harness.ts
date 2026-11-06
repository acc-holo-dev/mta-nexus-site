import { randomUUID } from "node:crypto";
import {
  auditEvents,
  libraryCollectionsRepository as collections,
  db,
  entitlements,
  libraryCollectionItems,
  libraryCollectionReceipts,
  libraryCollections,
  products,
  resourceReleaseWatches,
  sessionRepository,
  userRepository,
} from "@nexus/db";
import type { LibraryCollectionCommand } from "@nexus/domain";
import { and, eq } from "drizzle-orm";
import { applyLibraryMembershipBatch } from "../../packages/db/src/repositories/library-membership-batches";

export {
  and,
  auditEvents,
  collections,
  db,
  entitlements,
  eq,
  libraryCollectionItems,
  libraryCollectionReceipts,
  libraryCollections,
  products,
  randomUUID,
  resourceReleaseWatches,
};

// Requires disposable PostgreSQL migrated through 0067. Never disable guards
// to clean up fixtures: discard that database after the integration run.
export async function fixture() {
  const key = randomUUID().replaceAll("-", ""),
    userId = `usr_col_${key}`,
    other = `usr_col_other_${key}`,
    productId = `prd_col_${key}`;
  for (const id of [userId, other])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "user",
    });
  for (const id of [userId, other])
    await sessionRepository.create({
      id: `ses_${id}`,
      userId: id,
      token: `tok_${id}`,
      expiresAt: new Date(Date.now() + 3600000),
    });
  const currentToken = `tok_${userId}`;
  await db.insert(products).values({
    id: productId,
    title: "Private resource",
    slug: `col-${key}`,
    description: "Fixture",
    shortDescription: "Fixture",
    type: "script",
    authorId: other,
    status: "draft",
    price: 0,
  });
  const grantId = `ent_col_${key}`;
  await db.insert(entitlements).values({
    id: grantId,
    subjectType: "user",
    subjectId: userId,
    permission: "product.download",
    resourceId: productId,
  });
  function command(body: LibraryCollectionCommand, id?: string, auditId = `aud_${randomUUID()}`) {
    return collections.command({
      userId,
      currentToken,
      collectionId: id,
      command: body,
      newCollectionId: `lcol_${randomUUID().replaceAll("-", "")}`,
      receiptId: `lcr_${randomUUID().replaceAll("-", "")}`,
      auditId,
    });
  }
  return { userId, other, productId, grantId, command, currentToken };
}

// Batch acceptance requires disposable PostgreSQL migrated through 0069.
export async function batchFixture() {
  const f = await fixture(),
    productId = `${f.productId}_b`,
    grantId = `${f.grantId}_b`;
  await db.insert(products).values({
    id: productId,
    title: "Second private resource",
    slug: productId,
    description: "Fixture",
    shortDescription: "Fixture",
    type: "script",
    authorId: f.other,
    status: "draft",
    price: 0,
  });
  await db.insert(entitlements).values({
    id: grantId,
    subjectType: "user",
    subjectId: f.userId,
    permission: "product.download",
    resourceId: productId,
  });
  const created = await f.command({ requestId: randomUUID(), action: "create", name: "Batch" }),
    id = created.receipt.collection.id;
  return { ...f, id, productIds: [f.productId, productId].sort(), secondGrantId: grantId };
}

// Copy acceptance requires disposable PostgreSQL migrated through 0070.
export async function copyFixture() {
  const f = await fixture(),
    created = await f.command({ requestId: randomUUID(), action: "create", name: "Source" }),
    sourceId = created.receipt.collection.id;
  const prepare = async () => {
    const preview = await collections.copyPreview(f.userId, sourceId);
    return {
      requestId: randomUUID(),
      action: "duplicate" as const,
      name: "Independent copy",
      sourceCollectionId: sourceId,
      expectedRevision: preview.source.revision,
      expectedItemCount: preview.itemCount,
      sourceDigest: preview.sourceDigest,
    };
  };
  return { ...f, sourceId, prepare };
}

// Membership groups require disposable PostgreSQL migrated through 0077.
export async function membershipBatchFixture() {
  const f = await fixture(),
    a = await f.command({ requestId: randomUUID(), action: "create", name: "Membership source" }),
    b = await f.command({
      requestId: randomUUID(),
      action: "create",
      name: "Membership destination",
    });
  const source = a.receipt.collection.id,
    destination = b.receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    source,
  );
  const command = {
    requestId: randomUUID(),
    changes: [
      { collectionId: source, expectedRevision: 2, wasInCollection: true, inCollection: false },
      {
        collectionId: destination,
        expectedRevision: 1,
        wasInCollection: false,
        inCollection: true,
      },
    ],
  };
  const apply = (auditId = `aud_${randomUUID()}`) =>
    applyLibraryMembershipBatch({
      userId: f.userId,
      currentToken: f.currentToken,
      productId: f.productId,
      command,
      receiptId: `lmb_${randomUUID().replaceAll("-", "")}`,
      auditId,
      children: command.changes.map((change) => ({
        collectionId: change.collectionId,
        receiptId: `lcr_${randomUUID().replaceAll("-", "")}`,
        auditId: `aud_${randomUUID()}`,
      })),
    });
  return { ...f, source, destination, batchCommand: command, apply };
}

// Requires disposable PostgreSQL migrated through 0078.
export async function reconciliationFixture() {
  const f = await fixture(),
    fresh = await fixture();
  const id = (await f.command({ requestId: randomUUID(), action: "create", name: "Reconcile" }))
    .receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    id,
  );
  await db.delete(products).where(eq(products.id, f.productId));
  const grant = `ent_reconcile_${randomUUID()}`;
  await db.insert(entitlements).values({
    id: grant,
    subjectType: "user",
    subjectId: f.userId,
    permission: "product.download",
    resourceId: fresh.productId,
  });
  await db
    .insert(libraryCollectionItems)
    .values(
      Array.from({ length: 199 }, (_, i) => ({ collectionId: id, productId: `prd_orphan_${i}` })),
    );
  const command = {
    requestId: randomUUID(),
    action: "reconcile-items" as const,
    expectedRevision: 2,
    addProductIds: [fresh.productId],
    removeProductIds: [f.productId],
  };
  return { ...f, id, grant, reviewed: command, freshProductId: fresh.productId };
}

// Uses the existing 0078 reconciliation command; no additional migration.
export async function restorationFixture() {
  const f = await fixture(),
    fresh = await fixture(),
    later = await fixture();
  const id = (
    await f.command({ requestId: randomUUID(), action: "create", name: "Restore source" })
  ).receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    id,
  );
  for (const productId of [fresh.productId, later.productId])
    await db.insert(entitlements).values({
      id: `ent_restore_${randomUUID()}`,
      subjectType: "user",
      subjectId: f.userId,
      permission: "product.download",
      resourceId: productId,
    });
  const original = await f.command(
    {
      requestId: randomUUID(),
      action: "reconcile-items",
      expectedRevision: 2,
      addProductIds: [fresh.productId],
      removeProductIds: [f.productId],
    },
    id,
  );
  await f.command(
    { requestId: randomUUID(), action: "add", productId: later.productId, expectedRevision: 3 },
    id,
  );
  return { ...f, id, original, freshId: fresh.productId, laterId: later.productId };
}
