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
  userRepository,
} from "@nexus/db";
import type { LibraryCollectionCommand } from "@nexus/domain";
import { and, eq } from "drizzle-orm";
import { expect, it } from "vitest";

// Requires disposable PostgreSQL migrated through 0067. Never disable guards
// to clean up fixtures: discard that database after the integration run.
async function fixture() {
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
      collectionId: id,
      command: body,
      newCollectionId: `lcol_${randomUUID().replaceAll("-", "")}`,
      receiptId: `lcr_${randomUUID().replaceAll("-", "")}`,
      auditId,
    });
  }
  return { userId, other, productId, grantId, command };
}
it("concurrent creation retries persist one owned collection, receipt and audit", async () => {
  const f = await fixture(),
    body = { requestId: randomUUID(), action: "create" as const, name: "Core" };
  const results = await Promise.all(Array.from({ length: 4 }, () => f.command(body)));
  expect(results.filter((r) => !r.replayed)).toHaveLength(1);
  expect(new Set(results.map((r) => r.receipt.collection.id)).size).toBe(1);
  expect(
    await db.select().from(libraryCollections).where(eq(libraryCollections.userId, f.userId)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.userId, f.userId)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(eq(auditEvents.actorId, f.userId), eq(auditEvents.action, "library.collection_create")),
      ),
  ).toHaveLength(1);
});
it("concurrent successor commands cannot overwrite the same collection revision", async () => {
  const f = await fixture(),
    created = await f.command({ requestId: randomUUID(), action: "create", name: "Core" }),
    id = created.receipt.collection.id;
  const results = await Promise.allSettled(
    ["A", "B"].map((name) =>
      f.command({ requestId: randomUUID(), action: "rename", name, expectedRevision: 1 }, id),
    ),
  );
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  const failed = results.find((r) => r.status === "rejected");
  expect(failed?.status === "rejected" ? failed.reason : null).toMatchObject({
    code: "COLLECTION_CONFLICT",
  });
  expect((await collections.detail(f.userId, id)).collection.revision).toBe(2);
});
it("references survive lost access, do not grant files and can be removed by their owner", async () => {
  const f = await fixture(),
    created = await f.command({ requestId: randomUUID(), action: "create", name: "Core" }),
    id = created.receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    id,
  );
  expect((await collections.detail(f.userId, id)).items[0]).toMatchObject({
    hasAccess: true,
    downloadable: false,
  });
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  expect((await collections.detail(f.userId, id)).items[0]).toMatchObject({
    hasAccess: false,
    title: null,
    slug: null,
    version: null,
    downloadable: false,
  });
  await expect(collections.detail(f.other, id)).rejects.toMatchObject({ statusCode: 404 });
  await f.command(
    { requestId: randomUUID(), action: "remove", productId: f.productId, expectedRevision: 2 },
    id,
  );
  expect((await collections.detail(f.userId, id)).total).toBe(0);
  expect(
    await db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
  ).toHaveLength(0);
});
it("database guards retain receipts and reject archived member writes and invalid revisions", async () => {
  const f = await fixture(),
    created = await f.command({ requestId: randomUUID(), action: "create", name: "Core" }),
    id = created.receipt.collection.id;
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, id);
  await expect(
    db.insert(libraryCollectionItems).values({ collectionId: id, productId: f.productId }),
  ).rejects.toThrow();
  await expect(
    db.update(libraryCollections).set({ name: "Unchecked" }).where(eq(libraryCollections.id, id)),
  ).rejects.toThrow();
  await expect(
    db
      .update(libraryCollectionReceipts)
      .set({ snapshot: { ...created.receipt.collection, name: "Rewrite" } })
      .where(eq(libraryCollectionReceipts.id, created.receipt.id)),
  ).rejects.toThrow();
  await expect(
    db
      .delete(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.id, created.receipt.id)),
  ).rejects.toThrow();
  await f.command({ requestId: randomUUID(), action: "restore", expectedRevision: 2 }, id);
  expect((await collections.detail(f.userId, id)).collection).toMatchObject({
    revision: 3,
    status: "active",
    name: "Core",
  });
});
it("audit failure rolls back the collection revision and receipt together", async () => {
  const f = await fixture(),
    auditId = `aud_${randomUUID()}`,
    created = await f.command(
      { requestId: randomUUID(), action: "create", name: "Core" },
      undefined,
      auditId,
    ),
    id = created.receipt.collection.id;
  await expect(
    f.command(
      { requestId: randomUUID(), action: "rename", expectedRevision: 1, name: "Rolled back" },
      id,
      auditId,
    ),
  ).rejects.toThrow();
  expect((await collections.detail(f.userId, id)).collection).toMatchObject({
    name: "Core",
    revision: 1,
  });
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.collectionId, id)),
  ).toHaveLength(1);
});

// Batch acceptance requires disposable PostgreSQL migrated through 0069.
async function batchFixture() {
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
it("concurrent canonical batch retries persist two references and one successor receipt", async () => {
  const f = await batchFixture(),
    command = {
      requestId: randomUUID(),
      action: "add-many" as const,
      productIds: f.productIds,
      expectedRevision: 1,
    };
  const results = await Promise.all([
    f.command(command, f.id),
    f.command({ ...command, productIds: [...command.productIds].reverse() }, f.id),
  ]);
  expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  expect(results[0]?.receipt.id).toBe(results[1]?.receipt.id);
  const detail = await collections.detail(f.userId, f.id);
  expect(detail.total).toBe(2);
  expect(detail.collection.revision).toBe(2);
  expect((await collections.history(f.userId, f.id)).items).toHaveLength(2);
});
it("one revoked grant prevents every batch membership write and revision", async () => {
  const f = await batchFixture();
  await db.delete(entitlements).where(eq(entitlements.id, f.secondGrantId));
  await expect(
    f.command(
      {
        requestId: randomUUID(),
        action: "add-many",
        productIds: f.productIds,
        expectedRevision: 1,
      },
      f.id,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  const detail = await collections.detail(f.userId, f.id);
  expect(detail.total).toBe(0);
  expect(detail.collection.revision).toBe(1);
  expect((await collections.history(f.userId, f.id)).items).toHaveLength(1);
});
it("mandatory audit failure rolls back all batch references and the successor receipt", async () => {
  const f = await batchFixture(),
    auditId = `aud_${randomUUID()}`;
  await f.command(
    { requestId: randomUUID(), action: "rename", name: "Batch", expectedRevision: 1 },
    f.id,
    auditId,
  );
  await expect(
    f.command(
      {
        requestId: randomUUID(),
        action: "add-many",
        productIds: f.productIds,
        expectedRevision: 2,
      },
      f.id,
      auditId,
    ),
  ).rejects.toThrow();
  const detail = await collections.detail(f.userId, f.id);
  expect(detail.total).toBe(0);
  expect(detail.collection.revision).toBe(2);
  expect((await collections.history(f.userId, f.id)).items).toHaveLength(2);
});
it("bulk cleanup after revocation is replayable while stale cleanup cannot overwrite a revision", async () => {
  const f = await batchFixture();
  await f.command(
    { requestId: randomUUID(), action: "add-many", productIds: f.productIds, expectedRevision: 1 },
    f.id,
  );
  await db.delete(entitlements).where(eq(entitlements.subjectId, f.userId));
  const command = {
    requestId: randomUUID(),
    action: "remove-many" as const,
    productIds: f.productIds,
    expectedRevision: 2,
  };
  const receipt = await f.command(command, f.id);
  expect((await collections.detail(f.userId, f.id)).total).toBe(0);
  await expect(f.command({ ...command, requestId: randomUUID() }, f.id)).rejects.toMatchObject({
    code: "COLLECTION_CONFLICT",
  });
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 3 }, f.id);
  expect(await f.command(command, f.id)).toMatchObject({
    replayed: true,
    receipt: { id: receipt.receipt.id, collection: { revision: 3 } },
  });
});
it("database receipts reject batch duplicates and mismatched final membership", async () => {
  const f = await batchFixture();
  await f.command(
    { requestId: randomUUID(), action: "add-many", productIds: f.productIds, expectedRevision: 1 },
    f.id,
  );
  for (const productIds of [
    [f.productId, f.productId],
    [`prd_absent_${randomUUID().replaceAll("-", "")}`],
  ]) {
    const requestId = randomUUID();
    await expect(
      db.insert(libraryCollectionReceipts).values({
        id: `lcr_${randomUUID()}`,
        userId: f.userId,
        requestId,
        collectionId: f.id,
        commandDigest: "a".repeat(64),
        command: { requestId, action: "add-many", productIds, expectedRevision: 1 },
        snapshot: { id: f.id, name: "Batch", status: "active", revision: 2 },
      }),
    ).rejects.toThrow();
  }
});

// Copy acceptance requires disposable PostgreSQL migrated through 0070.
async function copyFixture() {
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
it("concurrent copy retries create one independent target, receipt and audit", async () => {
  const f = await copyFixture();
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    f.sourceId,
  );
  const command = await f.prepare(),
    results = await Promise.all([f.command(command), f.command(command), f.command(command)]);
  expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  expect(new Set(results.map((result) => result.receipt.collection.id)).size).toBe(1);
  const targetId = results[0]?.receipt.collection.id;
  if (!targetId) throw new Error("Missing copy target");
  expect(targetId).not.toBe(f.sourceId);
  expect((await collections.detail(f.userId, targetId)).total).toBe(1);
  expect((await collections.detail(f.userId, f.sourceId)).collection.revision).toBe(2);
  expect((await collections.history(f.userId, targetId)).items).toHaveLength(1);
  expect(
    await db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.actorId, f.userId),
          eq(auditEvents.action, "library.collection_duplicate"),
        ),
      ),
  ).toHaveLength(1);
});
it("copies all 200 archived references after access loss and keeps subsequent membership independent", async () => {
  const f = await copyFixture(),
    productIds = Array.from({ length: 200 }, (_, i) => `${f.productId}_ref_${i}`);
  // Populate retained references through the existing member quota guards.
  await db
    .insert(libraryCollectionItems)
    .values(productIds.map((productId) => ({ collectionId: f.sourceId, productId })));
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, f.sourceId);
  await db.delete(entitlements).where(eq(entitlements.subjectId, f.userId));
  const command = await f.prepare(),
    result = await f.command(command),
    targetId = result.receipt.collection.id;
  expect(result.receipt.collection).toMatchObject({ status: "active", revision: 1 });
  expect(command.expectedItemCount).toBe(200);
  expect((await collections.detail(f.userId, targetId)).total).toBe(200);
  expect(
    (await collections.detail(f.userId, targetId)).items.every(
      (item) => item.title === null && !item.hasAccess && !item.downloadable,
    ),
  ).toBe(true);
  const firstProductId = productIds[0];
  if (!firstProductId) throw new Error("Missing copied reference");
  await f.command(
    { requestId: randomUUID(), action: "remove", productId: firstProductId, expectedRevision: 1 },
    targetId,
  );
  expect((await collections.detail(f.userId, targetId)).total).toBe(199);
  const source = await collections.detail(f.userId, f.sourceId);
  expect(source.total).toBe(200);
  expect(source.collection).toMatchObject({ status: "archived", revision: 2 });
  expect(
    await db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
  ).toHaveLength(0);
});
it("a stale copy review creates nothing and a committed retry ignores later source changes", async () => {
  const f = await copyFixture(),
    stale = await f.prepare();
  await f.command(
    { requestId: randomUUID(), action: "rename", name: "Changed", expectedRevision: 1 },
    f.sourceId,
  );
  await expect(f.command(stale)).rejects.toMatchObject({ code: "COLLECTION_CONFLICT" });
  expect(
    await db.select().from(libraryCollections).where(eq(libraryCollections.userId, f.userId)),
  ).toHaveLength(1);
  const command = await f.prepare(),
    result = await f.command(command);
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 2 }, f.sourceId);
  expect(await f.command(command)).toMatchObject({
    replayed: true,
    receipt: { id: result.receipt.id },
  });
});
it("mandatory audit failure rolls back the target, copied members and receipt together", async () => {
  const f = await copyFixture(),
    auditId = `aud_${randomUUID()}`;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    f.sourceId,
    auditId,
  );
  const command = await f.prepare();
  await expect(f.command(command, undefined, auditId)).rejects.toThrow();
  expect(
    await db.select().from(libraryCollections).where(eq(libraryCollections.userId, f.userId)),
  ).toHaveLength(1);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.requestId, command.requestId)),
  ).toHaveLength(0);
  expect((await collections.detail(f.userId, f.sourceId)).total).toBe(1);
});
it("ownership and database content guards reject a foreign source and a partial-copy receipt", async () => {
  const f = await copyFixture();
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    f.sourceId,
  );
  const command = await f.prepare();
  await expect(collections.copyPreview(f.other, f.sourceId)).rejects.toMatchObject({
    statusCode: 404,
  });
  await expect(
    collections.command({
      userId: f.other,
      command,
      newCollectionId: `lcol_${randomUUID()}`,
      receiptId: `lcr_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
  const empty = await f.command({
    requestId: randomUUID(),
    action: "create",
    name: "Independent copy",
  });
  await expect(
    db.insert(libraryCollectionReceipts).values({
      id: `lcr_${randomUUID()}`,
      userId: f.userId,
      requestId: command.requestId,
      collectionId: empty.receipt.collection.id,
      commandDigest: "a".repeat(64),
      command,
      snapshot: empty.receipt.collection,
    }),
  ).rejects.toThrow();
});

// Selected-copy acceptance requires disposable PostgreSQL migrated through 0074.
it("copies selected orphaned references from an archived source once while preserving existing destination dates", async () => {
  const f = await copyFixture();
  const ids: [string,string] = [
    `prd_copy_missing_${randomUUID().replaceAll("-", "")}`,
    `prd_copy_missing_${randomUUID().replaceAll("-", "")}`,
  ];
  await db
    .insert(libraryCollectionItems)
    .values(ids.map((productId) => ({ collectionId: f.sourceId, productId })));
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, f.sourceId);
  const target = await f.command({ requestId: randomUUID(), action: "create", name: "Target" });
  const targetId = target.receipt.collection.id;
  await db.insert(libraryCollectionItems).values({ collectionId: targetId, productId: ids[0] });
  const [existing] = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, targetId));
  await db.delete(entitlements).where(eq(entitlements.subjectId, f.userId));
  const sourceBefore = await collections.detail(f.userId, f.sourceId);
  const body = {
    requestId: randomUUID(),
    action: "copy-items" as const,
    sourceCollectionId: f.sourceId,
    expectedSourceRevision: 2,
    productIds: ids,
    expectedRevision: 1,
  };
  const results = await Promise.all([
    f.command(body, targetId),
    f.command(body, targetId),
    f.command(body, targetId),
  ]);
  expect(results.filter((item) => !item.replayed)).toHaveLength(1);
  expect(new Set(results.map((item) => item.receipt.id)).size).toBe(1);
  const after = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, targetId));
  expect(after).toHaveLength(2);
  expect(after.find((item) => item.productId === ids[0])?.addedAt).toEqual(existing?.addedAt);
  expect(await collections.detail(f.userId, f.sourceId)).toEqual(sourceBefore);
  expect(
    await db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
  ).toHaveLength(0);
  const page = await collections.copyItemsPage(f.userId, f.sourceId);
  expect(page.items.every((item) => item.title === null)).toBe(true);
  await f.command({ requestId: randomUUID(), action: "restore", expectedRevision: 2 }, f.sourceId);
  await f.command(
    { requestId: randomUUID(), action: "remove-many", expectedRevision: 3, productIds: ids },
    f.sourceId,
  );
  expect((await f.command(body, targetId)).replayed).toBe(true);
});
it("rolls selected copying back on audit failure and rejects receipt proof for a reference outside the source", async () => {
  const f = await copyFixture();
  const productId = `prd_copy_missing_${randomUUID().replaceAll("-", "")}`;
  await db.insert(libraryCollectionItems).values({ collectionId: f.sourceId, productId });
  const duplicateAudit = `aud_copy_atomic_${randomUUID()}`;
  const target = await f.command(
    { requestId: randomUUID(), action: "create", name: "Atomic target" },
    undefined,
    duplicateAudit,
  );
  const id = target.receipt.collection.id;
  const body = {
    requestId: randomUUID(),
    action: "copy-items" as const,
    sourceCollectionId: f.sourceId,
    expectedSourceRevision: 1,
    productIds: [productId],
    expectedRevision: 1,
  };
  await expect(f.command(body, id, duplicateAudit)).rejects.toThrow();
  expect((await collections.detail(f.userId, id)).collection.revision).toBe(1);
  expect(
    await db
      .select()
      .from(libraryCollectionItems)
      .where(eq(libraryCollectionItems.collectionId, id)),
  ).toHaveLength(0);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.requestId, body.requestId)),
  ).toHaveLength(0);
  await expect(f.command({ ...body, productIds: [f.productId] }, id)).rejects.toMatchObject({
    code: "COLLECTION_CONFLICT",
  });
  await db.update(libraryCollections).set({ revision: 2 }).where(eq(libraryCollections.id, id));
  await db.insert(libraryCollectionItems).values({ collectionId: id, productId: f.productId });
  await expect(
    db
      .insert(libraryCollectionReceipts)
      .values({
        id: `lcr_${randomUUID().replaceAll("-", "")}`,
        userId: f.userId,
        requestId: body.requestId,
        collectionId: id,
        commandDigest: "a".repeat(64),
        command: { ...body, productIds: [f.productId] },
        snapshot: { id, name: "Atomic target", status: "active", revision: 2 },
      }),
  ).rejects.toThrow();
});

// Move acceptance requires disposable PostgreSQL migrated through 0075.
it("moves orphaned references exactly once with one receipt in both histories and unchanged destination duplicates", async () => {
  const f = await copyFixture();
  const ids: [string, string, string] = [
    `prd_move_missing_${randomUUID().replaceAll("-", "")}`,
    `prd_move_missing_${randomUUID().replaceAll("-", "")}`,
    `prd_move_retained_${randomUUID().replaceAll("-", "")}`,
  ];
  await db
    .insert(libraryCollectionItems)
    .values(ids.map((productId) => ({ collectionId: f.sourceId, productId })));
  const target = await f.command({
    requestId: randomUUID(),
    action: "create",
    name: "Move target",
  });
  const targetId = target.receipt.collection.id;
  await db.insert(libraryCollectionItems).values({ collectionId: targetId, productId: ids[0] });
  const [existing] = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, targetId));
  await db.delete(entitlements).where(eq(entitlements.subjectId, f.userId));
  const body = {
    requestId: randomUUID(),
    action: "move-items" as const,
    sourceCollectionId: f.sourceId,
    expectedSourceRevision: 1,
    productIds: ids.slice(0, 2),
    expectedRevision: 1,
  };
  const results = await Promise.all([
    f.command(body, targetId),
    f.command(body, targetId),
    f.command(body, targetId),
  ]);
  expect(results.filter((item) => !item.replayed)).toHaveLength(1);
  expect(new Set(results.map((item) => item.receipt.id)).size).toBe(1);
  expect(results[0]?.receipt.sourceCollection).toEqual({ id: f.sourceId, revision: 2 });
  const source = await collections.detail(f.userId, f.sourceId),
    destination = await collections.detail(f.userId, targetId);
  expect(source.collection.revision).toBe(2);
  expect(source.items.map((item) => item.productId)).toEqual([ids[2]]);
  expect(destination.collection.revision).toBe(2);
  expect(destination.items).toHaveLength(2);
  expect(destination.items.find((item) => item.productId === ids[0])?.addedAt).toEqual(
    existing?.addedAt,
  );
  const sourceHistory = await collections.history(f.userId, f.sourceId),
    targetHistory = await collections.history(f.userId, targetId);
  expect(sourceHistory.items.find((item) => item.command.action === "move-items")?.id).toBe(
    results[0]?.receipt.id,
  );
  expect(targetHistory.items.find((item) => item.command.action === "move-items")?.id).toBe(
    results[0]?.receipt.id,
  );
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 2 }, f.sourceId);
  expect((await f.command(body, targetId)).replayed).toBe(true);
  expect(
    await db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
  ).toHaveLength(0);
});
it("rolls both sides of a move back after audit failure and rejects a receipt if its source removal was not committed", async () => {
  const f = await copyFixture();
  const productId = `prd_move_missing_${randomUUID().replaceAll("-", "")}`;
  await db.insert(libraryCollectionItems).values({ collectionId: f.sourceId, productId });
  const duplicateAudit = `aud_move_atomic_${randomUUID()}`;
  const target = await f.command(
    { requestId: randomUUID(), action: "create", name: "Atomic move target" },
    undefined,
    duplicateAudit,
  );
  const id = target.receipt.collection.id;
  const sourceBefore = await collections.detail(f.userId, f.sourceId),
    targetBefore = await collections.detail(f.userId, id);
  const body = {
    requestId: randomUUID(),
    action: "move-items" as const,
    sourceCollectionId: f.sourceId,
    expectedSourceRevision: 1,
    productIds: [productId],
    expectedRevision: 1,
  };
  await expect(f.command(body, id, duplicateAudit)).rejects.toThrow();
  expect(await collections.detail(f.userId, f.sourceId)).toEqual(sourceBefore);
  expect(await collections.detail(f.userId, id)).toEqual(targetBefore);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.requestId, body.requestId)),
  ).toHaveLength(0);
  await db
    .update(libraryCollections)
    .set({ revision: 2 })
    .where(eq(libraryCollections.id, f.sourceId));
  await db.update(libraryCollections).set({ revision: 2 }).where(eq(libraryCollections.id, id));
  await db.insert(libraryCollectionItems).values({ collectionId: id, productId });
  await expect(
    db
      .insert(libraryCollectionReceipts)
      .values({
        id: `lcr_${randomUUID().replaceAll("-", "")}`,
        userId: f.userId,
        requestId: body.requestId,
        collectionId: id,
        commandDigest: "a".repeat(64),
        command: body,
        snapshot: { id, name: "Atomic move target", status: "active", revision: 2 },
      }),
  ).rejects.toThrow();
});

it("inspects draft memberships privately and retains removal after access loss and product deletion", async () => {
  const f = await fixture();
  const created = await f.command({
    requestId: randomUUID(),
    action: "create",
    name: "Resource memberships",
  });
  const id = created.receipt.collection.id;
  const before = await collections.resourceMemberships(f.userId, f.productId);
  expect(before.resource).toEqual({
    productId: f.productId,
    title: null,
    available: false,
    canAdd: true,
  });
  expect(before.collections).toContainEqual(
    expect.objectContaining({ id, inCollection: false, itemCount: 0 }),
  );
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    id,
  );
  await expect(collections.resourceMemberships(f.other, f.productId)).rejects.toMatchObject({
    statusCode: 404,
  });
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  await db.delete(products).where(eq(products.id, f.productId));
  const orphan = await collections.resourceMemberships(f.userId, f.productId);
  expect(orphan.resource).toEqual({
    productId: f.productId,
    title: null,
    available: false,
    canAdd: false,
  });
  expect(orphan.collections).toContainEqual(
    expect.objectContaining({ id, inCollection: true, itemCount: 1, revision: 2 }),
  );
  await f.command(
    { requestId: randomUUID(), action: "remove", productId: f.productId, expectedRevision: 2 },
    id,
  );
  await expect(collections.resourceMemberships(f.userId, f.productId)).rejects.toMatchObject({
    statusCode: 404,
  });
});

it("reads whole owner commands by resource/window and retains their masked evidence after removal", async () => {
  const { readLibraryCollectionHistory } = await import(
    "../packages/db/src/repositories/library-collection-history"
  );
  const f = await fixture();
  const created = await f.command({
    requestId: randomUUID(),
    action: "create",
    name: "History collection",
  });
  const id = created.receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    id,
  );
  const query = {
    page: 1,
    days: 7 as const,
    action: "all" as const,
    collectionId: id,
    productId: f.productId,
  };
  const first = await readLibraryCollectionHistory(f.userId, query);
  expect(first.total).toBe(1);
  expect(first.items[0]?.resources).toEqual([
    { productId: f.productId, currentTitle: null, currentAvailable: false },
  ]);
  expect((await readLibraryCollectionHistory(f.other, query)).total).toBe(0);
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  await f.command(
    { requestId: randomUUID(), action: "remove", productId: f.productId, expectedRevision: 2 },
    id,
  );
  const history = await readLibraryCollectionHistory(f.userId, query);
  expect(history.total).toBe(2);
  expect(history.items.map((item) => item.receipt?.command.action)).toEqual(["remove", "add"]);
  expect(history.items.every((item) => item.currentCollection?.revision === 3)).toBe(true);
  expect(history.items.every((item) => item.resources[0]?.currentTitle === null)).toBe(true);
});

it("compares archived own orphan sets and applies a reviewed missing-reference copy without new rights", async () => {
  const { readLibraryCollectionComparison } = await import(
    "../packages/db/src/repositories/library-collection-comparison"
  );
  const f = await copyFixture();
  const ids = [0, 1, 2].map(() => `prd_compare_missing_${randomUUID().replaceAll("-", "")}`) as [
    string,
    string,
    string,
  ];
  const target = await f.command({
    requestId: randomUUID(),
    action: "create",
    name: "Comparison destination",
  });
  const targetId = target.receipt.collection.id;
  await db.insert(libraryCollectionItems).values([
    { collectionId: f.sourceId, productId: ids[0] },
    { collectionId: f.sourceId, productId: ids[1] },
    { collectionId: targetId, productId: ids[1] },
    { collectionId: targetId, productId: ids[2] },
  ]);
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, f.sourceId);
  const query = { to: targetId, page: 1, filter: "all" as const, q: "", transfer: "copy" as const };
  const report = await readLibraryCollectionComparison(f.userId, f.sourceId, query);
  if (!report.comparison) throw new Error("Missing comparison proof");
  expect(report.comparison?.counts).toEqual({
    all: 3,
    sourceOnly: 1,
    destinationOnly: 1,
    common: 1,
    unavailable: 3,
  });
  expect(report.comparison?.items.every((item) => item.title === null)).toBe(true);
  await expect(readLibraryCollectionComparison(f.other, f.sourceId, query)).rejects.toMatchObject({
    statusCode: 404,
  });
  const missing = await readLibraryCollectionComparison(f.userId, f.sourceId, {
    ...query,
    filter: "source-only",
  });
  if (!missing.comparison) throw new Error("Missing reference selection");
  expect(missing.comparison.items.map((item) => item.productId)).toEqual([ids[0]]);
  await f.command(
    {
      requestId: randomUUID(),
      action: "copy-items",
      sourceCollectionId: f.sourceId,
      expectedSourceRevision: report.source.revision,
      expectedRevision: report.comparison.destination.revision,
      productIds: missing.comparison.items.map((item) => item.productId),
    },
    targetId,
  );
  const after = await readLibraryCollectionComparison(f.userId, f.sourceId, query);
  expect(after.comparison?.counts).toMatchObject({
    all: 3,
    sourceOnly: 0,
    destinationOnly: 1,
    common: 2,
  });
  expect(after.source.revision).toBe(report.source.revision);
  expect(after.comparison?.destination.revision).toBe(report.comparison.destination.revision + 1);
  expect(
    (await readLibraryCollectionComparison(f.userId, f.sourceId, { ...query, q: "missing" }))
      .comparison?.total,
  ).toBe(0);
});

// Membership groups require disposable PostgreSQL migrated through 0077.
async function membershipBatchFixture() {
  const { applyLibraryMembershipBatch } = await import(
    "../packages/db/src/repositories/library-membership-batches"
  );
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
  return { ...f, source, destination, batchCommand:command, apply };
}
it("atomically updates resource membership in multiple own collections and replays immutable children after later edits", async () => {
  const f = await membershipBatchFixture(),
    results = await Promise.all([f.apply(), f.apply(), f.apply()]);
  expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  expect(new Set(results.map((result) => result.receipt.id)).size).toBe(1);
  expect((await collections.detail(f.userId, f.source)).total).toBe(0);
  expect((await collections.detail(f.userId, f.destination)).total).toBe(1);
  await f.command(
    { requestId: randomUUID(), action: "rename", expectedRevision: 3, name: "Later source" },
    f.source,
  );
  await f.command(
    { requestId: randomUUID(), action: "archive", expectedRevision: 2 },
    f.destination,
  );
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  const replay = await f.apply();
  expect(replay.replayed).toBe(true);
  expect(replay.receipt).toEqual(results[0]?.receipt);
  expect(
    replay.receipt.children.find((child) => child.collection.id === f.source)?.collection.revision,
  ).toBe(3);
  expect(
    (await collections.history(f.userId, f.destination)).items.some(
      (child) =>
        child.id ===
        replay.receipt.children.find((child) => child.collection.id === f.destination)?.id,
    ),
  ).toBe(true);
});
it("rolls back every membership, revision, child/parent receipt and audit when the required parent audit fails", async () => {
  const { libraryMembershipBatchReceipts } = await import("../packages/db/src/schema");
  const f = await membershipBatchFixture();
  const [existing] = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actorId, f.userId))
    .limit(1);
  if (!existing) throw Error("Missing duplicate audit fixture");
  const receiptsBefore=await db.select().from(libraryCollectionReceipts).where(eq(libraryCollectionReceipts.userId,f.userId));
  const auditsBefore=await db.select().from(auditEvents).where(eq(auditEvents.actorId,f.userId));
  await expect(f.apply(existing.id)).rejects.toThrow();
  expect(await db.select().from(libraryCollectionReceipts).where(eq(libraryCollectionReceipts.userId,f.userId))).toEqual(receiptsBefore);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId,f.userId))).toEqual(auditsBefore);
  expect((await collections.detail(f.userId, f.source)).collection.revision).toBe(2);
  expect((await collections.detail(f.userId, f.source)).total).toBe(1);
  expect((await collections.detail(f.userId, f.destination)).collection.revision).toBe(1);
  expect((await collections.detail(f.userId, f.destination)).total).toBe(0);
  expect(
    await db
      .select()
      .from(libraryMembershipBatchReceipts)
      .where(eq(libraryMembershipBatchReceipts.userId, f.userId)),
  ).toHaveLength(0);
  const result = await f.apply();
  await expect(
    db
      .update(libraryMembershipBatchReceipts)
      .set({ productId: "prd_other" })
      .where(eq(libraryMembershipBatchReceipts.id, result.receipt.id)),
  ).rejects.toThrow();
  await expect(
    db
      .delete(libraryMembershipBatchReceipts)
      .where(eq(libraryMembershipBatchReceipts.id, result.receipt.id)),
  ).rejects.toThrow();
});

it("reads immutable whole membership groups after later collection edits and deletion of the resource, with stable owner-only detail", async () => {
  const { readLibraryMembershipHistory, readLibraryMembershipHistoryDetail } = await import(
    "../packages/db/src/repositories/library-membership-history"
  );
  const f = await membershipBatchFixture(),
    saved = await f.apply();
  await f.command(
    { requestId: randomUUID(), action: "rename", expectedRevision: 3, name: "Later source" },
    f.source,
  );
  await f.command(
    { requestId: randomUUID(), action: "archive", expectedRevision: 2 },
    f.destination,
  );
  await db.delete(products).where(eq(products.id, f.productId));
  const report = await readLibraryMembershipHistory(f.userId, {
    page: 1,
    days: 7,
    operation: "mixed",
    productId: f.productId,
    collectionId: f.source,
  });
  expect(report.total).toBe(1);
  expect(report.items[0]?.receipt).toEqual(saved.receipt);
  expect(report.items[0]?.receipt?.children).toHaveLength(2);
  expect(report.items[0]?.resource).toEqual({
    productId: f.productId,
    currentTitle: null,
    currentAvailable: false,
  });
  expect(report.items[0]?.collections.find((row) => row.collectionId === f.source)).toMatchObject({
    current: { name: "Later source", revision: 4 },
    inCollection: false,
  });
  expect(
    report.items[0]?.collections.find((row) => row.collectionId === f.destination),
  ).toMatchObject({ current: { status: "archived", revision: 3 }, inCollection: true });
  await f.command(
    { requestId: randomUUID(), action: "restore", expectedRevision: 3 },
    f.destination,
  );
  await f.command(
    { requestId: randomUUID(), action: "remove", productId: f.productId, expectedRevision: 4 },
    f.destination,
  );
  await expect(collections.resourceMemberships(f.userId, f.productId)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(
    (await readLibraryMembershipHistoryDetail(f.userId, saved.receipt.id)).item.receipt,
  ).toEqual(saved.receipt);
  await expect(readLibraryMembershipHistoryDetail(f.other, saved.receipt.id)).rejects.toMatchObject(
    { statusCode: 404 },
  );
});

it("exports own orphan references but imports only current own access, then rechecks access atomically when saving", async () => {
  const { exportLibraryCollection, previewLibraryCollectionImport } = await import(
    "../packages/db/src/repositories/library-collection-manifests"
  );
  const f = await fixture();
  const source = (
    await f.command({ requestId: randomUUID(), action: "create", name: "Portable source" })
  ).receipt.collection.id;
  const destination = (
    await f.command({ requestId: randomUUID(), action: "create", name: "Import destination" })
  ).receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    source,
  );
  const manifest = await exportLibraryCollection(f.userId, source);
  expect(manifest.productIds).toEqual([f.productId]);
  const preview = await previewLibraryCollectionImport(f.userId, destination, manifest);
  expect(preview.items[0]).toMatchObject({
    productId: f.productId,
    title: null,
    available: false,
    canAdd: true,
    inCollection: false,
  });
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  const request = {
    requestId: randomUUID(),
    action: "add-many" as const,
    expectedRevision: preview.collection.revision,
    productIds: manifest.productIds,
  };
  await expect(f.command(request, destination)).rejects.toMatchObject({ statusCode: 404 });
  expect((await collections.detail(f.userId, destination)).total).toBe(0);
  expect((await collections.detail(f.userId, destination)).collection.revision).toBe(1);
  expect((await collections.history(f.userId, destination)).items).toHaveLength(1);
  await db
    .insert(entitlements)
    .values({
      id: `ent_col_import_${randomUUID()}`,
      subjectType: "user",
      subjectId: f.userId,
      permission: "product.download",
      resourceId: f.productId,
    });
  const saved = await f.command(request, destination),
    replay = await f.command(request, destination);
  expect(replay.replayed).toBe(true);
  expect(replay.receipt).toEqual(saved.receipt);
  expect(
    (await previewLibraryCollectionImport(f.userId, destination, manifest)).items[0],
  ).toMatchObject({ inCollection: true, canAdd: false });
  await db.delete(products).where(eq(products.id, f.productId));
  expect((await exportLibraryCollection(f.userId, source)).productIds).toEqual([f.productId]);
  expect(
    (await previewLibraryCollectionImport(f.userId, destination, manifest)).items[0],
  ).toMatchObject({ title: null, canAdd: false, inCollection: true });
  await expect(exportLibraryCollection(f.other, source)).rejects.toMatchObject({ statusCode: 404 });
});

// Requires disposable PostgreSQL migrated through 0078.
async function reconciliationFixture() {
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
  await db
    .insert(entitlements)
    .values({
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
it("atomically swaps references in a full collection and replays original proof after edits/archive/access loss", async () => {
  const f = await reconciliationFixture(),
    results = await Promise.all([
      f.command(f.reviewed, f.id),
      f.command(f.reviewed, f.id),
      f.command(f.reviewed, f.id),
    ]);
  expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  expect(new Set(results.map((result) => result.receipt.id)).size).toBe(1);
  expect((await collections.detail(f.userId, f.id)).total).toBe(200);
  const members = await db
    .select({ id: libraryCollectionItems.productId })
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, f.id));
  expect(members.some((row) => row.id === f.productId)).toBe(false);
  expect(members.some((row) => row.id === f.freshProductId)).toBe(true);
  await f.command(
    { requestId: randomUUID(), action: "rename", name: "Later", expectedRevision: 3 },
    f.id,
  );
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 4 }, f.id);
  await db.delete(entitlements).where(eq(entitlements.id, f.grant));
  const replay = await f.command(f.reviewed, f.id);
  expect(replay.replayed).toBe(true);
  expect(replay.receipt).toEqual(results[0]?.receipt);
  const { readLibraryCollectionHistory } = await import(
    "../packages/db/src/repositories/library-collection-history"
  );
  const history = await readLibraryCollectionHistory(f.userId, {
    page: 1,
    days: 7,
    action: "reconcile-items",
    productId: f.productId,
  });
  expect(history.items[0]?.receipt).toEqual(replay.receipt);
  expect(history.items[0]?.resources).toHaveLength(2);
  await expect(
    collections.command({
      userId: f.other,
      collectionId: f.id,
      command: { ...f.reviewed, requestId: randomUUID() },
      newCollectionId: `lcol_${randomUUID()}`,
      receiptId: `lcr_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
    }),
  ).rejects.toMatchObject({ statusCode: 404 });
});

it("rolls back removals, additions, revision and receipt when the required reconciliation audit fails", async () => {
  const f = await reconciliationFixture();
  const [audit] = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actorId, f.userId))
    .limit(1);
  if (!audit) throw Error("Missing audit fixture");
  const before = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, f.id));
  const receiptsBefore = await db
    .select()
    .from(libraryCollectionReceipts)
    .where(eq(libraryCollectionReceipts.collectionId, f.id));
  await expect(f.command(f.reviewed, f.id, audit.id)).rejects.toThrow();
  const after = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, f.id));
  expect(after.sort((a, b) => a.productId.localeCompare(b.productId))).toEqual(
    before.sort((a, b) => a.productId.localeCompare(b.productId)),
  );
  expect((await collections.detail(f.userId, f.id)).collection.revision).toBe(2);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.collectionId, f.id)),
  ).toEqual(receiptsBefore);
});

// Uses the existing 0078 reconciliation command; no additional migration.
async function restorationFixture() {
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
    await db
      .insert(entitlements)
      .values({
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
it("restores only recorded reconciliation differences, retaining later unrelated references/dates and original proof", async () => {
  const { readLibraryCollectionReceiptDetail } = await import(
    "../packages/db/src/repositories/library-collection-receipt-detail"
  );
  const f = await restorationFixture();
  const detail = await readLibraryCollectionReceiptDetail(f.userId, f.original.receipt.id);
  expect(detail.receipt).toEqual(f.original.receipt);
  const plan = detail.restoration;
  if (!plan) throw Error("Missing restoration plan");
  expect(plan.collection.revision).toBe(4);
  expect(plan.items.find((item) => item.productId === f.laterId)).toMatchObject({
    inCollection: true,
    canAdd: false,
    canRemove: false,
  });
  const [laterBefore] = await db
    .select()
    .from(libraryCollectionItems)
    .where(
      and(
        eq(libraryCollectionItems.collectionId, f.id),
        eq(libraryCollectionItems.productId, f.laterId),
      ),
    );
  const inverse = {
    requestId: randomUUID(),
    action: "reconcile-items" as const,
    expectedRevision: plan.collection.revision,
    addProductIds: plan.items.filter((item) => item.canAdd).map((item) => item.productId),
    removeProductIds: plan.items.filter((item) => item.canRemove).map((item) => item.productId),
  };
  const saved = await f.command(inverse, f.id),
    replay = await f.command(inverse, f.id);
  expect(replay.replayed).toBe(true);
  expect(replay.receipt).toEqual(saved.receipt);
  const members = await db
    .select()
    .from(libraryCollectionItems)
    .where(eq(libraryCollectionItems.collectionId, f.id));
  expect(new Set(members.map((item) => item.productId))).toEqual(new Set([f.productId, f.laterId]));
  expect(members.find((item) => item.productId === f.laterId)).toEqual(laterBefore);
  const refreshed = await readLibraryCollectionReceiptDetail(f.userId, f.original.receipt.id);
  expect(refreshed.receipt).toEqual(f.original.receipt);
  expect(refreshed.resources.every((item) => item.status === "already-restored")).toBe(true);
  expect(refreshed.restoration?.items.every((item) => !item.canAdd && !item.canRemove)).toBe(true);
  expect((await readLibraryCollectionReceiptDetail(f.userId, saved.receipt.id)).receipt).toEqual(
    saved.receipt,
  );
  await expect(
    readLibraryCollectionReceiptDetail(f.other, f.original.receipt.id),
  ).rejects.toMatchObject({ statusCode: 404 });
});
it("rechecks restoration addition access before removing current references and leaves no partial inverse receipt", async () => {
  const { readLibraryCollectionReceiptDetail } = await import(
    "../packages/db/src/repositories/library-collection-receipt-detail"
  );
  const f = await restorationFixture(),
    detail = await readLibraryCollectionReceiptDetail(f.userId, f.original.receipt.id),
    plan = detail.restoration;
  if (!plan) throw Error("Missing plan");
  const before = await db
      .select()
      .from(libraryCollectionItems)
      .where(eq(libraryCollectionItems.collectionId, f.id)),
    receiptsBefore = await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.collectionId, f.id));
  await db.delete(entitlements).where(eq(entitlements.id, f.grantId));
  await expect(
    f.command(
      {
        requestId: randomUUID(),
        action: "reconcile-items",
        expectedRevision: plan.collection.revision,
        addProductIds: [f.productId],
        removeProductIds: [f.freshId],
      },
      f.id,
    ),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(
    await db
      .select()
      .from(libraryCollectionItems)
      .where(eq(libraryCollectionItems.collectionId, f.id)),
  ).toEqual(before);
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.collectionId, f.id)),
  ).toEqual(receiptsBefore);
  expect((await collections.detail(f.userId, f.id)).collection.revision).toBe(4);
  expect(
    (await readLibraryCollectionReceiptDetail(f.userId, f.original.receipt.id)).resources.find(
      (item) => item.productId === f.productId,
    ),
  ).toMatchObject({ status: "no-access", currentTitle: null });
});
