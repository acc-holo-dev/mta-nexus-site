import { expect, it } from "vitest";
import {
  and,
  auditEvents,
  collections,
  db,
  entitlements,
  eq,
  fixture,
  libraryCollectionItems,
  libraryCollectionReceipts,
  libraryCollections,
  randomUUID,
  resourceReleaseWatches,
} from "./helpers/library-collections-persistence-harness";

// Requires disposable PostgreSQL migrated through 0067. Never disable guards
// to clean up fixtures: discard that database after the integration run.
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
  expect(
    await db
      .select()
      .from(resourceReleaseWatches)
      .where(eq(resourceReleaseWatches.userId, f.userId)),
  ).toHaveLength(0);
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
  expect(
    await db
      .select()
      .from(resourceReleaseWatches)
      .where(eq(resourceReleaseWatches.userId, f.userId)),
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
