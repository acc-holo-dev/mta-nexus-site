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
  await db
    .insert(products)
    .values({
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
  await db
    .insert(entitlements)
    .values({
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
      db
        .insert(libraryCollectionReceipts)
        .values({
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
