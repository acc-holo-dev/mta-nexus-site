import { expect, it } from "vitest";
import {
  auditEvents,
  collections,
  copyFixture,
  db,
  entitlements,
  eq,
  fixture,
  libraryCollectionItems,
  libraryCollectionReceipts,
  membershipBatchFixture,
  products,
  randomUUID,
} from "./helpers/library-collections-persistence-harness";

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
  const receiptsBefore = await db
    .select()
    .from(libraryCollectionReceipts)
    .where(eq(libraryCollectionReceipts.userId, f.userId));
  const auditsBefore = await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.userId));
  await expect(f.apply(existing.id)).rejects.toThrow();
  expect(
    await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.userId, f.userId)),
  ).toEqual(receiptsBefore);
  expect(await db.select().from(auditEvents).where(eq(auditEvents.actorId, f.userId))).toEqual(
    auditsBefore,
  );
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

it("finds whole own resource memberships across active/archived collections and orphan references without private title search leakage", async () => {
  const { readLibraryCollectionInventory } = await import(
    "../packages/db/src/repositories/library-collection-inventory"
  );
  const f = await fixture(),
    fresh = await fixture();
  const a = (
      await f.command({ requestId: randomUUID(), action: "create", name: "Inventory active" })
    ).receipt.collection.id,
    b = (await f.command({ requestId: randomUUID(), action: "create", name: "Inventory archived" }))
      .receipt.collection.id;
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    a,
  );
  await f.command(
    { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
    b,
  );
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 2 }, b);
  await db.insert(entitlements).values({
    id: `ent_inventory_${randomUUID()}`,
    subjectType: "user",
    subjectId: f.userId,
    permission: "product.download",
    resourceId: fresh.productId,
  });
  await f.command(
    { requestId: randomUUID(), action: "add", productId: fresh.productId, expectedRevision: 2 },
    a,
  );
  await db.delete(products).where(eq(products.id, fresh.productId));
  const query = { page: 1, status: "all" as const, filter: "all" as const, q: "" },
    report = await readLibraryCollectionInventory(f.userId, query);
  expect(report.counts).toEqual({
    resources: 2,
    references: 3,
    available: 0,
    unavailable: 2,
    shared: 1,
  });
  expect(report.items.every((item) => item.title === null)).toBe(true);
  const scoped = await readLibraryCollectionInventory(f.userId, {
    ...query,
    collectionId: a,
    status: "active",
    filter: "shared",
  });
  expect(scoped.total).toBe(1);
  expect(new Set(scoped.items[0]?.memberships.map((row) => row.id))).toEqual(new Set([a, b]));
  expect(
    (await readLibraryCollectionInventory(f.userId, { ...query, q: "Private resource" })).total,
  ).toBe(0);
  expect(
    (await readLibraryCollectionInventory(f.userId, { ...query, q: fresh.productId })).items[0]
      ?.productId,
  ).toBe(fresh.productId);
  expect((await readLibraryCollectionInventory(f.other, query)).items).toEqual([]);
  await expect(
    readLibraryCollectionInventory(f.other, { ...query, collectionId: a }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(
    (
      await readLibraryCollectionInventory(f.userId, {
        ...query,
        collectionId: b,
        status: "active",
      })
    ).total,
  ).toBe(0);
});
