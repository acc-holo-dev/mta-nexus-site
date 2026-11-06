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
  products,
  randomUUID,
  reconciliationFixture,
  restorationFixture,
} from "./helpers/library-collections-persistence-harness";

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
  await db.insert(entitlements).values({
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
      currentToken: `tok_${f.other}`,
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
