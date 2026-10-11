import { randomBytes } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  userRepository,
  productRepository,
  buildRepository,
  resourceDownloadAuthorizationRepository as authorization,
  resourceDeliveriesRepository as receipts,
} from "@nexus/db";
import { auditEvents, products, resourceDeliveryReceipts, users } from "../packages/db/src/schema";
// Requires disposable PostgreSQL migrated through 0056; never run against an
// operator's database. No payment, license issuance or subscription activation.
function present<T>(value: T | null | undefined): T {
  if (value == null) throw new Error("Missing fixture");
  return value;
}
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_dlv_${key}`,
    other = `usr_dlv_other_${key}`,
    productId = `prd_dlv_${key}`,
    buildId = `bld_dlv_${key}`;
  for (const id of [owner, other])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "developer",
    });
  await productRepository.create({
    id: productId,
    title: "Delivery archive",
    slug: productId,
    description: "Delivery evidence fixture",
    authorId: owner,
    type: "script",
    status: "published",
    price: 0,
    currency: "USD",
    licenseModel: "unlimited",
    tags: [],
    screenshots: [],
    currentVersion: "1.0.0",
    ratingAverage: 0,
    ratingCount: 0,
    salesCount: 0,
    isFeatured: false,
    compatibility: { dependencies: [] },
  });
  await buildRepository.create({
    id: buildId,
    productId,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration-scanner",
    scannedAt: new Date(),
    fileName: "fixture.zip",
    mimeType: "application/zip",
    fileSizeBytes: 7,
    sha256Hash: "a".repeat(64),
    storageKey: `private/${key}.zip`,
  });
  const expected = present(await buildRepository.findById(buildId));
  async function start(
    id = `dlv_${randomBytes(8).toString("hex")}`,
    auditId = `aud_${randomBytes(8).toString("hex")}`,
  ) {
    await authorization.authorize({
      actorId: owner,
      expected,
      pinned: true,
      receiptId: id,
      auditId,
    });
    return id;
  }
  const cleanup = async () => {
    await db.delete(auditEvents).where(eq(auditEvents.targetId, productId));
    await db.delete(products).where(eq(products.id, productId));
    for (const id of [owner, other]) await db.delete(users).where(eq(users.id, id));
  };
  return { key, owner, other, productId, buildId, expected, start, cleanup };
}
it("rolls back mandatory receipt creation when the start audit cannot commit", async () => {
  const f = await fixture(),
    id = `dlv_rollback_${f.key}`,
    auditId = `aud_dup_${f.key}`;
  try {
    await db
      .insert(auditEvents)
      .values({
        id: auditId,
        action: "fixture",
        actorId: f.owner,
        actorType: "user",
        targetType: "product",
        targetId: f.productId,
      });
    await expect(f.start(id, auditId)).rejects.toThrow();
    const [total] = await db
      .select({ total: count() })
      .from(resourceDeliveryReceipts)
      .where(eq(resourceDeliveryReceipts.id, id));
    expect(total.total).toBe(0);
  } finally {
    await f.cleanup();
  }
});
it("terminal CAS and immutable evidence survive concurrent completion/cancellation", async () => {
  const f = await fixture();
  try {
    const id = await f.start();
    const results = await Promise.all([
      receipts.finish({
        userId: f.owner,
        receiptId: id,
        auditId: `aud_done_${f.key}`,
        result: { status: "served", bytesSent: 7, errorCode: null },
      }),
      receipts.finish({
        userId: f.owner,
        receiptId: id,
        auditId: `aud_cancel_${f.key}`,
        result: { status: "cancelled", bytesSent: 3, errorCode: null },
      }),
    ]);
    expect(results.filter(Boolean)).toHaveLength(1);
    const record = await receipts.detail(f.owner, id);
    expect(record.status).not.toBe("started");
    expect(record.finishedAt).not.toBeNull();
    expect(
      await receipts.finish({
        userId: f.owner,
        receiptId: id,
        auditId: `aud_retry_${f.key}`,
        result: { status: "served", bytesSent: 7, errorCode: null },
      }),
    ).toBeNull();
    await expect(
      db
        .update(resourceDeliveryReceipts)
        .set({ version: "9.0.0" })
        .where(eq(resourceDeliveryReceipts.id, id)),
    ).rejects.toThrow();
    await expect(
      db.delete(resourceDeliveryReceipts).where(eq(resourceDeliveryReceipts.id, id)),
    ).rejects.toThrow();
    await expect(receipts.detail(f.other, id)).rejects.toMatchObject({ statusCode: 404 });
    const [events] = await db
      .select({ total: count() })
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.targetId, f.productId),
          eq(auditEvents.action, "product.download_finished"),
        ),
      );
    expect(events.total).toBe(1);
  } finally {
    await f.cleanup();
  }
});
it("a failed terminal audit leaves uncertainty, while invalid terminal evidence is denied by PostgreSQL", async () => {
  const f = await fixture();
  try {
    const auditId = `aud_start_${f.key}`,
      id = await f.start(`dlv_guard_${f.key}`, auditId);
    await expect(
      receipts.finish({
        userId: f.owner,
        receiptId: id,
        auditId,
        result: { status: "served", bytesSent: 7, errorCode: null },
      }),
    ).rejects.toThrow();
    expect((await receipts.detail(f.owner, id)).status).toBe("started");
    await expect(
      db
        .update(resourceDeliveryReceipts)
        .set({ status: "served", bytesSent: 3 })
        .where(eq(resourceDeliveryReceipts.id, id)),
    ).rejects.toThrow();
    await expect(
      db
        .update(resourceDeliveryReceipts)
        .set({ status: "failed", errorCode: null })
        .where(eq(resourceDeliveryReceipts.id, id)),
    ).rejects.toThrow();
    const [old] = await db
      .select()
      .from(resourceDeliveryReceipts)
      .where(eq(resourceDeliveryReceipts.id, id));
    await expect(
      db
        .insert(resourceDeliveryReceipts)
        .values({
          ...present(old),
          id: `dlv_fake_${f.key}`,
          status: "served",
          bytesSent: 7,
          finishedAt: new Date(),
        }),
    ).rejects.toThrow();
    expect((await receipts.detail(f.owner, id)).finishedAt).toBeNull();
  } finally {
    await f.cleanup();
  }
});
it("withdrawal and deletion retain personal evidence without granting repeat access", async () => {
  const f = await fixture();
  try {
    const id = await f.start();
    expect((await receipts.detail(f.owner, id)).downloadable).toBe(true);
    await db.update(products).set({ status: "archived" }).where(eq(products.id, f.productId));
    expect(await receipts.detail(f.owner, id)).toMatchObject({
      downloadable: false,
      title: null,
      buildId: f.buildId,
    });
    await db.delete(products).where(eq(products.id, f.productId));
    expect(await receipts.detail(f.owner, id)).toMatchObject({
      downloadable: false,
      title: null,
      resourceId: f.productId,
    });
    const [identity] = await db.execute<{ build_id: string }>(
      sql`select build_id from resource_delivery_receipts where id = ${id}`,
    );
    expect(identity.build_id).toBe(f.buildId);
  } finally {
    await f.cleanup();
  }
});
