import { expect, it } from "vitest";
import {
  batchFixture,
  collections,
  db,
  entitlements,
  eq,
  libraryCollectionReceipts,
  randomUUID,
} from "./helpers/library-collections-persistence-harness";

// Batch acceptance requires disposable PostgreSQL migrated through 0069.
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
