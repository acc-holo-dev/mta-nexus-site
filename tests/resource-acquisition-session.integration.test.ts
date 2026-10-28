import { randomUUID } from "node:crypto";
import {
  auditEvents,
  builds,
  db,
  entitlements,
  entitlementRepository,
  products,
  resourceAcquisitionEvents,
  resourceCartAcquisitions,
  resourceCartItems,
  resourceCartRepository as cart,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

async function fixture() {
  const key = randomUUID().replaceAll("-", "");
  const userId = `usr_acquisition_${key}`;
  const productId = `prd_acquisition_${key}`;
  const token = `acquisition-token-${key}`;
  const sessionId = `ses_acquisition_${key}`;
  await userRepository.create({
    id: userId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Resource session fixture",
    role: "developer",
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await db.insert(products).values({
    id: productId,
    authorId: userId,
    title: "Resource session fixture",
    description: "Safe free acquisition fixture",
    slug: productId,
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: `bld_acquisition_${key}`,
    productId,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration-test",
    scannedAt: new Date(),
    storageKey: `fixture/${key}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
  });
  await cart.add(userId, productId);
  const review = await cart.review(userId);
  if (!review.reviewDigest) throw new Error("Missing resource review");
  return {
    userId,
    productId,
    token,
    sessionId,
    direct: {
      userId,
      productId,
      currentToken: token,
      entitlementId: `ent_direct_${key}`,
    },
    cart: {
      userId,
      currentToken: token,
      productIds: [productId],
      requestId: randomUUID(),
      entitlementIds: [`ent_cart_${key}`],
      auditId: `aud_cart_${key}`,
      reviewDigest: review.reviewDigest,
    },
  };
}

async function expectUnchanged(f: Awaited<ReturnType<typeof fixture>>) {
  const [grant] = await db
    .select({ total: count() })
    .from(entitlements)
    .where(eq(entitlements.subjectId, f.userId));
  const [event] = await db
    .select({ total: count() })
    .from(resourceAcquisitionEvents)
    .where(eq(resourceAcquisitionEvents.userId, f.userId));
  const [receipt] = await db
    .select({ total: count() })
    .from(resourceCartAcquisitions)
    .where(eq(resourceCartAcquisitions.userId, f.userId));
  const [audit] = await db
    .select({ total: count() })
    .from(auditEvents)
    .where(eq(auditEvents.id, f.cart.auditId));
  const [item] = await db
    .select({ total: count() })
    .from(resourceCartItems)
    .where(eq(resourceCartItems.userId, f.userId));
  const [product] = await db
    .select({ salesCount: products.salesCount })
    .from(products)
    .where(eq(products.id, f.productId));
  expect([grant?.total, event?.total, receipt?.total, audit?.total, item?.total]).toEqual([
    0, 0, 0, 0, 1,
  ]);
  expect(product?.salesCount).toBe(0);
}

for (const state of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`rejects direct and cart acquisition with a ${state} initiating session atomically`, async () => {
    const f = await fixture();
    let currentToken = f.token;
    if (state === "revoked") await sessionRepository.delete(f.token);
    if (state === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (state === "foreign") currentToken = (await fixture()).token;
    if (state === "missing") currentToken = "";
    await expect(
      entitlementRepository.claimFreeResource({ ...f.direct, currentToken }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(cart.acquire({ ...f.cart, currentToken })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expectUnchanged(f);
  });
}

it("requires a current session for existing direct access and durable cart replay", async () => {
  const f = await fixture();
  const result = await cart.acquire(f.cart);
  expect(await cart.acquire(f.cart)).toEqual(result);
  expect(await entitlementRepository.claimFreeResource(f.direct)).toMatchObject({
    alreadyClaimed: true,
  });
  await sessionRepository.delete(f.token);
  await expect(entitlementRepository.claimFreeResource(f.direct)).rejects.toMatchObject({
    code: "UNAUTHORIZED",
  });
  await expect(cart.acquire(f.cart)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  const [receipt] = await db
    .select({ total: count() })
    .from(resourceCartAcquisitions)
    .where(eq(resourceCartAcquisitions.userId, f.userId));
  const [event] = await db
    .select({ total: count() })
    .from(resourceAcquisitionEvents)
    .where(eq(resourceAcquisitionEvents.userId, f.userId));
  expect([receipt?.total, event?.total]).toEqual([1, 1]);
});

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitFor(predicate: () => Promise<boolean>, message: string) {
  const until = Date.now() + 10000;
  while (Date.now() < until) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}
async function waitForLock(table: "products" | "sessions") {
  await waitFor(async () => {
    const rows = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname = current_database()
      and pid <> pg_backend_pid() and wait_event_type = 'Lock'
      and query like ${`%"${table}"%for%update%`}
    ) as waiting`);
    return rows[0]?.waiting === true;
  }, `Acquisition did not wait on ${table}`);
}

for (const source of ["direct", "cart"] as const) {
  it(`rejects a session revoked while ${source} acquisition waits on the resource`, async () => {
    const f = await fixture();
    const locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx
        .select({ id: products.id })
        .from(products)
        .where(eq(products.id, f.productId))
        .for("update");
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = (
      source === "direct" ? entitlementRepository.claimFreeResource(f.direct) : cart.acquire(f.cart)
    ).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("products");
      await sessionRepository.delete(f.token);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    await expectUnchanged(f);
  }, 20000);
}

it("rejects expiry during a cart session-row wait before issuing grants or its receipt", async () => {
  const f = await fixture();
  const expiresAt = new Date(Date.now() + 5000);
  await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, f.sessionId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = cart.acquire(f.cart).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock("sessions");
    await waitFor(async () => Date.now() >= expiresAt.getTime(), "Session did not expire");
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  await expectUnchanged(f);
}, 20000);
