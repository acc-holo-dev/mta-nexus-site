import { randomUUID } from "node:crypto";
import {
  builds,
  resourceCartRepository as cart,
  db,
  entitlementRepository,
  entitlements,
  licenses,
  products,
  resourceAcquisitionEvents,
  resourceCartAcquisitions,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

type AccessSource = "entitlement" | "license";
type AcquisitionSource = "direct" | "cart";

async function fixture(accessSource: AccessSource, expiresAt = new Date(Date.now() + 60000)) {
  const key = randomUUID().replaceAll("-", "");
  const userId = `usr_access_expiry_${key}`;
  const productId = `prd_access_expiry_${key}`;
  const sessionId = `ses_access_expiry_${key}`;
  const accessId = `access_expiry_${key}`;
  const token = `access-expiry-token-${key}`;
  await userRepository.create({
    id: userId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Resource access expiry fixture",
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
    title: "Resource access expiry fixture",
    slug: productId,
    description: "Safe free acquisition fixture",
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: `bld_access_expiry_${key}`,
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
  if (accessSource === "entitlement") {
    await entitlementRepository.create({
      id: accessId,
      subjectType: "user",
      subjectId: userId,
      resourceId: productId,
      permission: "product.download",
      expiresAt,
    });
  } else {
    await db.insert(licenses).values({
      id: accessId,
      key: `private-${key}`,
      userId,
      productId,
      model: "unlimited",
      status: "active",
      expiresAt,
    });
  }
  await cart.add(userId, productId, token);
  const review = await cart.review(userId);
  if (!review.reviewDigest) throw new Error("Missing resource review");
  return {
    userId,
    productId,
    sessionId,
    accessId,
    accessSource,
    token,
    direct: {
      userId,
      productId,
      currentToken: token,
      entitlementId: `ent_access_expiry_${key}`,
    },
    cart: {
      userId,
      currentToken: token,
      productIds: [productId],
      requestId: randomUUID(),
      entitlementIds: [`ent_access_expiry_${key}`],
      auditId: `aud_access_expiry_${key}`,
      reviewDigest: review.reviewDigest,
    },
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

async function waitFor(predicate: () => Promise<boolean>, message: string) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(message);
}

async function acquireAfterExpiry(
  f: Fixture,
  source: AcquisitionSource,
  lock: "entitlement" | "license" | "session",
) {
  const expiresAt = new Date(Date.now() + 3000);
  if (f.accessSource === "entitlement")
    await db.update(entitlements).set({ expiresAt }).where(eq(entitlements.id, f.accessId));
  else await db.update(licenses).set({ expiresAt }).where(eq(licenses.id, f.accessId));
  const table = lock === "session" ? sessions : lock === "license" ? licenses : entitlements;
  const id = lock === "session" ? f.sessionId : f.accessId;
  const locked = deferred<number>();
  const release = deferred<void>();
  const blocker = db.transaction(async (tx) => {
    await tx.execute(sql`select ${table.id} from ${table} where ${table.id} = ${id} for update`);
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    locked.resolve(row.pid);
    await release.promise;
  });
  const pid = await Promise.race([locked.promise, blocker.then(() => 0)]);
  const pending = (
    source === "direct" ? entitlementRepository.claimFreeResource(f.direct) : cart.acquire(f.cart)
  ).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitFor(async () => {
      const [row] = await db.execute<{ waiting: boolean }>(sql`select exists (
        select 1 from pg_stat_activity
        where datname = current_database() and ${pid} = any(pg_blocking_pids(pid))
          and wait_event_type = 'Lock'
      ) as waiting`);
      return row.waiting;
    }, `Acquisition did not wait on ${lock}`);
    expect(Date.now()).toBeLessThan(expiresAt.getTime());
    await waitFor(async () => Date.now() >= expiresAt.getTime(), "Access did not expire");
  } finally {
    release.resolve();
    await blocker;
    await pending;
  }
  const result = await pending;
  if ("error" in result) throw result.error;
  return result.value;
}

async function expectAcquisitions(f: Fixture, total: number) {
  const [event] = await db
    .select({ total: count() })
    .from(resourceAcquisitionEvents)
    .where(eq(resourceAcquisitionEvents.userId, f.userId));
  const [product] = await db
    .select({ salesCount: products.salesCount })
    .from(products)
    .where(eq(products.id, f.productId));
  expect([event.total, product.salesCount]).toEqual([total, total]);
}

for (const [source, accessSource, lock] of [
  ["direct", "entitlement", "entitlement"],
  ["cart", "license", "license"],
  ["cart", "entitlement", "session"],
  ["direct", "license", "session"],
] as const) {
  it(`renews ${accessSource} access expiring during a ${source} ${lock}-row wait`, async () => {
    const f = await fixture(accessSource);
    const result = await acquireAfterExpiry(f, source, lock);
    if (source === "cart") {
      expect(result).toMatchObject({
        acquired: [{ productId: f.productId, alreadyClaimed: false }],
      });
      const [receipt] = await db
        .select({ snapshot: resourceCartAcquisitions.reviewSnapshot })
        .from(resourceCartAcquisitions)
        .where(eq(resourceCartAcquisitions.requestId, f.cart.requestId));
      expect(receipt.snapshot).toMatchObject([
        { alreadyClaimed: false, accessSource: "entitlement", recordedExpiresAt: null },
      ]);
      expect(await cart.acquire(f.cart)).toEqual(result);
    } else {
      expect(result).toMatchObject({
        alreadyClaimed: false,
        entitlement: { id: f.direct.entitlementId, expiresAt: null },
      });
    }
    expect(await entitlementRepository.claimFreeResource(f.direct)).toMatchObject({
      alreadyClaimed: true,
      entitlement: { id: f.direct.entitlementId, expiresAt: null },
    });
    await expectAcquisitions(f, 1);
  }, 20000);
}

it("keeps live legacy access after a finite grant expires during a cart session wait, then allows re-acquisition after revocation", async () => {
  const f = await fixture("entitlement");
  const licenseId = `lic_fallback_${f.accessId}`;
  const expiresAt = new Date(Date.now() + 3600000);
  await db.insert(licenses).values({
    id: licenseId,
    key: `private-${licenseId}`,
    userId: f.userId,
    productId: f.productId,
    model: "unlimited",
    status: "active",
    expiresAt,
  });
  const result = await acquireAfterExpiry(f, "cart", "session");
  expect(result).toMatchObject({
    acquired: [{ productId: f.productId, alreadyClaimed: true }],
  });
  const [receipt] = await db
    .select({ snapshot: resourceCartAcquisitions.reviewSnapshot })
    .from(resourceCartAcquisitions)
    .where(eq(resourceCartAcquisitions.requestId, f.cart.requestId));
  expect(receipt.snapshot).toMatchObject([
    {
      alreadyClaimed: true,
      accessSource: "license",
      recordedExpiresAt: expiresAt.toISOString(),
    },
  ]);
  await expectAcquisitions(f, 0);
  const [legacy] = await db
    .select({ expiresAt: licenses.expiresAt, status: licenses.status })
    .from(licenses)
    .where(eq(licenses.id, licenseId));
  expect(legacy).toEqual({ status: "active", expiresAt });
  await db.update(licenses).set({ status: "revoked" }).where(eq(licenses.id, licenseId));
  // Receipt retries retain their historical access facts after revocation.
  expect(await cart.acquire(f.cart)).toEqual(result);
  expect(await entitlementRepository.claimFreeResource(f.direct)).toMatchObject({
    alreadyClaimed: false,
    entitlement: { id: f.direct.entitlementId, expiresAt: null },
  });
  await expectAcquisitions(f, 1);
}, 20000);

it.each([null, new Date(Date.now() + 3600000)])(
  "returns surviving entitlement access when another grant expires during a session wait (%s)",
  async (expiresAt) => {
    const f = await fixture("entitlement");
    const survivingId = `ent_surviving_${f.accessId}`;
    await entitlementRepository.create({
      id: survivingId,
      subjectType: "user",
      subjectId: f.userId,
      resourceId: f.productId,
      permission: "product.download",
      expiresAt: expiresAt ?? undefined,
    });
    expect(await acquireAfterExpiry(f, "direct", "session")).toMatchObject({
      alreadyClaimed: true,
      entitlement: { id: survivingId, expiresAt },
    });
    await expectAcquisitions(f, 0);
  },
  20000,
);
