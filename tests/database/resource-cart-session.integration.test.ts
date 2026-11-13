import { randomUUID } from "node:crypto";
import {
  builds,
  db,
  products,
  resourceCartItems,
  resourceCartRepository as cart,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import { asc, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";

async function account() {
  const key = randomUUID().replaceAll("-", "");
  const userId = `usr_cart_session_${key}`;
  const token = `cart-session-token-${key}`;
  const sessionId = `ses_cart_${key}`;
  await userRepository.create({
    id: userId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Cart session fixture",
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { userId, token, sessionId, key };
}
async function fixture() {
  const actor = await account();
  const ids = ["existing", "new"].map((name) => `prd_cart_${name}_${actor.key}`);
  for (const productId of ids) {
    await db.insert(products).values({
      id: productId,
      authorId: actor.userId,
      title: "Cart session fixture",
      description: "Published free resource",
      slug: productId,
      type: "script",
      status: "published",
    });
    await db.insert(builds).values({
      id: `bld_${productId}`,
      productId,
      version: "1.0.0",
      status: "published",
      scanStatus: "clean",
      scanner: "integration-test",
      scannedAt: new Date(),
      storageKey: `fixture/${productId}.zip`,
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 7,
    });
  }
  const [existingId, newId] = ids;
  if (!existingId || !newId) throw new Error("Missing fixture resource");
  await cart.add(actor.userId, existingId, actor.token);
  return { ...actor, existingId, newId };
}
async function items(userId: string) {
  return db
    .select({ productId: resourceCartItems.productId })
    .from(resourceCartItems)
    .where(eq(resourceCartItems.userId, userId))
    .orderBy(asc(resourceCartItems.productId));
}

for (const invalid of ["revoked", "expired", "foreign", "missing"] as const) {
  it(`rejects cart insert, removal and idempotent replies with a ${invalid} session`, async () => {
    const f = await fixture();
    let token = f.token;
    if (invalid === "revoked") await sessionRepository.delete(token);
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "foreign") token = (await account()).token;
    if (invalid === "missing") token = "";
    const before = await items(f.userId);
    for (const productId of [f.existingId, f.newId]) {
      await expect(cart.add(f.userId, productId, token)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
      await expect(cart.remove(f.userId, productId, token)).rejects.toMatchObject({
        code: "UNAUTHORIZED",
      });
    }
    expect(await items(f.userId)).toEqual(before);
  });
}

it("preserves valid idempotent mutations and removal of a withdrawn resource", async () => {
  const f = await fixture();
  await cart.add(f.userId, f.newId, f.token);
  await cart.add(f.userId, f.newId, f.token);
  expect(await items(f.userId)).toHaveLength(2);
  await db.update(products).set({ status: "draft" }).where(eq(products.id, f.existingId));
  await cart.remove(f.userId, f.existingId, f.token);
  await cart.remove(f.userId, f.existingId, f.token);
  expect(await items(f.userId)).toEqual([{ productId: f.newId }]);
});

function deferred() {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock(fragment: string) {
  await expect
    .poll(
      async () => {
        const rows = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname = current_database()
      and pid <> pg_backend_pid() and wait_event_type = 'Lock'
      and query like ${`%${fragment}%`}
    ) as waiting`);
        return rows[0]?.waiting === true;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}
for (const action of ["add", "remove"] as const) {
  it(`rejects ${action} when its session is revoked during the cart lock wait`, async () => {
    const f = await fixture();
    const before = await items(f.userId);
    const locked = deferred(),
      release = deferred();
    const blocker = db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`resource-cart:${f.userId}`}))`);
      locked.resolve();
      await release.promise;
    });
    await Promise.race([locked.promise, blocker]);
    const pending = cart[action](f.userId, action === "add" ? f.newId : f.existingId, f.token).then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    try {
      await waitForLock("pg_advisory_xact_lock");
      await sessionRepository.delete(f.token);
    } finally {
      release.resolve();
      await blocker;
    }
    expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await items(f.userId)).toEqual(before);
  }, 20000);
}
it("rechecks the session after waiting on resource availability", async () => {
  const f = await fixture();
  const before = await items(f.userId);
  const locked = deferred(),
    release = deferred();
  const blocker = db.transaction(async (tx) => {
    await tx
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, f.newId))
      .for("update");
    locked.resolve();
    await release.promise;
  });
  await Promise.race([locked.promise, blocker]);
  const pending = cart.add(f.userId, f.newId, f.token).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock('"products"');
    await sessionRepository.delete(f.token);
  } finally {
    release.resolve();
    await blocker;
  }
  expect(await pending).toMatchObject({ error: { code: "UNAUTHORIZED" } });
  expect(await items(f.userId)).toEqual(before);
}, 20000);
