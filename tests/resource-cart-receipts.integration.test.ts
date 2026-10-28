import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, or } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  db,
  userRepository,
  resourceCartRepository as cart,
  resourceCartReceiptsRepository as receipts,
  buildRepository,
  sessionRepository,
} from "@nexus/db";
import {
  auditEvents,
  builds,
  entitlements,
  products,
  resourceAcquisitionEvents,
  resourceCartAcquisitions,
  users,
} from "../packages/db/src/schema";
// Disposable isolated PostgreSQL migrated through 0058; these tests never
// create completed payments, license terms, subscriptions or file deliveries.
async function fixture() {
  const key = randomBytes(8).toString("hex"),
    owner = `usr_cr_owner_${key}`,
    buyer = `usr_cr_buyer_${key}`,
    staff = `usr_cr_staff_${key}`,
    productId = `prd_cr_${key}`;
  for (const [id, role] of [
    [owner, "developer"],
    [buyer, "user"],
    [staff, "moderator"],
  ] as const)
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role,
    });
  await sessionRepository.create({
    id: `ses_${staff}`,
    userId: staff,
    token: `tok_${staff}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await db.insert(products).values({
    id: productId,
    authorId: owner,
    title: "Original receipt title",
    description: "Receipt fixture description",
    slug: productId,
    type: "script",
    status: "published",
  });
  const buildId = `bld_cr_${key}_1`;
  await db.insert(builds).values({
    id: buildId,
    productId,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration",
    scannedAt: new Date(),
    storageKey: `fixture/${key}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
  });
  await cart.add(buyer, productId);
  const review = await cart.review(buyer);
  if (!review.reviewDigest) throw new Error("Missing review");
  const input = {
    userId: buyer,
    requestId: randomUUID(),
    productIds: [productId],
    entitlementIds: [`ent_cr_${key}`],
    auditId: `aud_cr_${key}`,
    reviewDigest: review.reviewDigest,
  };
  async function release() {
    const next = `bld_cr_${key}_2`;
    await db.insert(builds).values({
      id: next,
      productId,
      version: "2.0.0",
      status: "pending_review",
      scanStatus: "clean",
      scanner: "integration",
      scannedAt: new Date(),
      storageKey: `fixture/${key}_2.zip`,
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 8,
      createdAt: new Date(Date.now() + 1000),
    });
    const reviewed = await buildRepository.moderatePending(
      next,
      "approve",
      {
        id: `aud_cr_review_${key}`,
        actorId: staff,
        actorType: "user",
        action: "build.approved",
        targetType: "build",
        targetId: next,
      },
      1,
      `tok_${staff}`,
    );
    if (!reviewed) throw new Error("Missing approved release");
    return next;
  }
  async function cleanup() {
    await db
      .delete(auditEvents)
      .where(
        or(
          eq(auditEvents.actorId, buyer),
          eq(auditEvents.actorId, owner),
          eq(auditEvents.actorId, staff),
        ),
      );
    await db.delete(entitlements).where(eq(entitlements.subjectId, buyer));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, buyer));
    await db.delete(users).where(eq(users.id, staff));
    await db.delete(users).where(eq(users.id, owner));
  }
  return { owner, buyer, productId, buildId, input, release, cleanup };
}
it("concurrent exact retries produce one receipt/grant and immutable evidence survives resource removal", async () => {
  const f = await fixture();
  try {
    const [a, b] = await Promise.all([cart.acquire(f.input), cart.acquire(f.input)]);
    expect(a).toEqual(b);
    expect(
      (
        await db
          .select({ n: count() })
          .from(resourceCartAcquisitions)
          .where(eq(resourceCartAcquisitions.userId, f.buyer))
      )[0].n,
    ).toBe(1);
    expect(
      (
        await db
          .select({ n: count() })
          .from(resourceAcquisitionEvents)
          .where(eq(resourceAcquisitionEvents.userId, f.buyer))
      )[0].n,
    ).toBe(1);
    await expect(
      db
        .update(resourceCartAcquisitions)
        .set({ reviewDigest: "b".repeat(64) })
        .where(eq(resourceCartAcquisitions.userId, f.buyer)),
    ).rejects.toThrow();
    await expect(
      db.delete(resourceCartAcquisitions).where(eq(resourceCartAcquisitions.userId, f.buyer)),
    ).rejects.toThrow();
    await db.delete(products).where(eq(products.id, f.productId));
    const detail = await receipts.detail(f.buyer, f.input.requestId);
    expect(detail.items[0]).toMatchObject({
      title: "Original receipt title",
      buildId: f.buildId,
      downloadable: false,
    });
    await expect(receipts.detail(f.owner, f.input.requestId)).rejects.toMatchObject({
      statusCode: 404,
    });
  } finally {
    await f.cleanup();
  }
});
it("a newly approved release invalidates the old review before any grant, then a new review succeeds", async () => {
  const f = await fixture();
  try {
    const next = await f.release();
    await expect(cart.acquire(f.input)).rejects.toMatchObject({
      code: "RESOURCE_CART_REVIEW_CHANGED",
    });
    expect(
      (
        await db
          .select({ n: count() })
          .from(entitlements)
          .where(eq(entitlements.subjectId, f.buyer))
      )[0].n,
    ).toBe(0);
    const review = await cart.review(f.buyer);
    if (!review.reviewDigest) throw new Error("Missing review");
    await cart.acquire({ ...f.input, reviewDigest: review.reviewDigest });
    expect((await receipts.detail(f.buyer, f.input.requestId)).items[0].buildId).toBe(next);
  } finally {
    await f.cleanup();
  }
});
it("different simultaneous request keys cannot acquire a cleared cart twice or reuse another review", async () => {
  const f = await fixture();
  try {
    const requests = [
      f.input,
      {
        ...f.input,
        requestId: randomUUID(),
        entitlementIds: [`ent_cr_alt_${randomBytes(8).toString("hex")}`],
        auditId: `aud_cr_alt_${randomBytes(8).toString("hex")}`,
      },
    ];
    const results = await Promise.allSettled(requests.map((input) => cart.acquire(input)));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const winner = requests[results.findIndex((result) => result.status === "fulfilled")];
    await expect(cart.acquire({ ...winner, reviewDigest: "f".repeat(64) })).rejects.toMatchObject({
      code: "RESOURCE_CART_REQUEST_CONFLICT",
    });
    expect(
      (
        await db
          .select({ n: count() })
          .from(resourceCartAcquisitions)
          .where(eq(resourceCartAcquisitions.userId, f.buyer))
      )[0].n,
    ).toBe(1);
  } finally {
    await f.cleanup();
  }
});
it("an audit failure rolls back grants/cart/receipt and legacy receipts preserve absent evidence", async () => {
  const f = await fixture();
  try {
    await db.insert(auditEvents).values({
      id: f.input.auditId,
      actorId: f.buyer,
      actorType: "user",
      action: "fixture",
      targetType: "product",
      targetId: f.productId,
    });
    await expect(cart.acquire(f.input)).rejects.toThrow();
    expect((await cart.get(f.buyer)).items).toHaveLength(1);
    expect(
      (
        await db
          .select({ n: count() })
          .from(entitlements)
          .where(eq(entitlements.subjectId, f.buyer))
      )[0].n,
    ).toBe(0);
    expect(
      (
        await db
          .select({ n: count() })
          .from(resourceCartAcquisitions)
          .where(eq(resourceCartAcquisitions.userId, f.buyer))
      )[0].n,
    ).toBe(0);
    await db.insert(resourceCartAcquisitions).values({
      userId: f.buyer,
      requestId: f.input.requestId,
      productIds: [f.productId],
      result: {
        kind: "free_resource_acquisition",
        acquired: [{ productId: f.productId, alreadyClaimed: false }],
      },
    });
    expect(await receipts.detail(f.buyer, f.input.requestId)).toMatchObject({
      reviewed: false,
      items: [],
      legacyProductCount: 1,
    });
    await expect(
      db
        .update(resourceCartAcquisitions)
        .set({ reviewSnapshot: [] })
        .where(
          and(
            eq(resourceCartAcquisitions.userId, f.buyer),
            eq(resourceCartAcquisitions.requestId, f.input.requestId),
          ),
        ),
    ).rejects.toThrow();
  } finally {
    await f.cleanup();
  }
});
