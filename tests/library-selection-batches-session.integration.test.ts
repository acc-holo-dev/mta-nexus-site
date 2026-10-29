import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  builds,
  db,
  entitlementRepository,
  entitlements,
  libraryCollectionItems,
  libraryCollections,
  librarySelectionBatchReceipts,
  librarySelectionBatchesRepository as batches,
  licenses,
  products,
  resourceLibrarySelections,
  sessionRepository,
  sessions,
  userRepository,
  users,
} from "@nexus/db";
import type { LibrarySelectionBatchCommand } from "@nexus/domain";
import { asc, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import type { ResourceTransaction } from "../packages/db/src/transaction";

async function identity() {
  const key = randomUUID().replaceAll("-", ""),
    userId = `usr_lsb_session_${key}`,
    token = `lsb-session-token-${key}`,
    sessionId = `ses_lsb_session_${key}`;
  await userRepository.create({
    id: userId,
    username: key,
    email: `${key}@nexus.test`,
    displayName: "Selection session fixture",
    role: "user",
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  return { key, userId, token, sessionId };
}
async function fixture(access: "entitlement" | "license" = "entitlement") {
  const f = await identity(),
    productId = `prd_lsb_${f.key}`,
    collectionId = `lcol_lsb_${f.key}`,
    buildId = `bld_lsb_${f.key}`,
    accessId = `access_lsb_${f.key}`;
  await db.insert(products).values({
    id: productId,
    authorId: f.userId,
    title: "Selection session fixture",
    slug: productId,
    description: "Selection session fixture",
    type: "script",
    status: "published",
  });
  await db.insert(builds).values({
    id: buildId,
    productId,
    version: "1.0.0",
    status: "published",
    scanStatus: "clean",
    scanner: "integration-test",
    scannedAt: new Date(),
    storageKey: `fixture/${f.key}.zip`,
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 7,
  });
  if (access === "entitlement")
    await entitlementRepository.create({
      id: accessId,
      subjectType: "user",
      subjectId: f.userId,
      resourceId: productId,
      permission: "product.download",
    });
  else
    await db.insert(licenses).values({
      id: accessId,
      key: `private-${f.key}`,
      userId: f.userId,
      productId,
      model: "unlimited",
      status: "active",
    });
  await db
    .insert(libraryCollections)
    .values({ id: collectionId, userId: f.userId, name: "Session fixture" });
  await db.insert(libraryCollectionItems).values({ collectionId, productId });
  const choice = { mode: "fixed" as const, productIds: [productId] },
    preview = await batches.preview(f.userId, collectionId, choice);
  return {
    ...f,
    productId,
    collectionId,
    buildId,
    accessId,
    access,
    input: {
      userId: f.userId,
      currentToken: f.token,
      collectionId,
      command: {
        ...choice,
        requestId: randomUUID(),
        previewDigest: preview.previewDigest,
      } as LibrarySelectionBatchCommand,
      receiptId: `lsbr_session_${f.key}`,
      auditId: `aud_lsb_session_${f.key}`,
    },
  };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function state(f: Fixture) {
  const selections = await db
    .select()
    .from(resourceLibrarySelections)
    .where(eq(resourceLibrarySelections.userId, f.userId))
    .orderBy(asc(resourceLibrarySelections.productId));
  const receipts = await db
    .select()
    .from(librarySelectionBatchReceipts)
    .where(eq(librarySelectionBatchReceipts.userId, f.userId))
    .orderBy(asc(librarySelectionBatchReceipts.id));
  const audits = await db
    .select()
    .from(auditEvents)
    .where(eq(auditEvents.actorId, f.userId))
    .orderBy(asc(auditEvents.id));
  return { selections, receipts, audits };
}

for (const invalid of ["missing", "unknown", "digest", "foreign", "expired", "revoked"] as const) {
  it(`rejects new commands and exact replays with a ${invalid} initiating session`, async () => {
    const f = await fixture();
    await batches.command(f.input);
    const before = await state(f);
    let token = f.token;
    if (invalid === "missing") token = "";
    if (invalid === "unknown") token = `unknown-${randomUUID()}`;
    if (invalid === "digest") token = createHash("sha256").update(token).digest("hex");
    if (invalid === "foreign") token = (await identity()).token;
    if (invalid === "expired")
      await db
        .update(sessions)
        .set({ expiresAt: new Date(0) })
        .where(eq(sessions.id, f.sessionId));
    if (invalid === "revoked") await sessionRepository.delete(token);
    for (const command of [f.input.command, { ...f.input.command, requestId: randomUUID() }])
      await expect(
        batches.command({ ...f.input, currentToken: token, command }),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(await state(f)).toEqual(before);
  });
}

it("applies once and replays the same receipt without leaking its initiating token", async () => {
  const f = await fixture(),
    result = await batches.command(f.input);
  expect(result.replayed).toBe(false);
  expect(await batches.command(f.input)).toEqual({ ...result, replayed: true });
  const saved = await state(f);
  expect([saved.selections.length, saved.receipts.length, saved.audits.length]).toEqual([1, 1, 2]);
  expect(JSON.stringify(saved)).not.toContain(f.token);
  expect(JSON.stringify(saved)).not.toContain(createHash("sha256").update(f.token).digest("hex"));
});

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function waitForLock(pid: number) {
  await expect
    .poll(
      async () => {
        const [row] = await db.execute<{ waiting: boolean }>(sql`select exists (
      select 1 from pg_stat_activity where datname = current_database()
        and ${pid} = any(pg_blocking_pids(pid)) and wait_event_type = 'Lock'
    ) as waiting`);
        return row.waiting;
      },
      { timeout: 10000, interval: 10 },
    )
    .toBe(true);
}
type Target =
  | "account"
  | "selection-advisory"
  | "actor"
  | "collection"
  | "member"
  | "product"
  | "grant"
  | "selection"
  | "build"
  | "session";
async function lock(tx: ResourceTransaction, f: Fixture, target: Target) {
  if (target === "account" || target === "selection-advisory") {
    const key =
      target === "account"
        ? `library-collections:${f.userId}`
        : `library-selection:${f.userId}:${f.productId}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  } else if (target === "actor")
    await tx.select().from(users).where(eq(users.id, f.userId)).for("update");
  else if (target === "collection")
    await tx
      .select()
      .from(libraryCollections)
      .where(eq(libraryCollections.id, f.collectionId))
      .for("update");
  else if (target === "member")
    await tx
      .select()
      .from(libraryCollectionItems)
      .where(eq(libraryCollectionItems.collectionId, f.collectionId))
      .for("update");
  else if (target === "product")
    await tx.select().from(products).where(eq(products.id, f.productId)).for("update");
  else if (target === "grant")
    await tx.select().from(entitlements).where(eq(entitlements.id, f.accessId)).for("update");
  else if (target === "selection")
    await tx
      .select()
      .from(resourceLibrarySelections)
      .where(eq(resourceLibrarySelections.userId, f.userId))
      .for("update");
  else if (target === "build")
    await tx.select().from(builds).where(eq(builds.id, f.buildId)).for("update");
  else await tx.select().from(sessions).where(eq(sessions.id, f.sessionId)).for("update");
}
async function duringWait(
  f: Fixture,
  target: Target,
  action: () => Promise<void>,
  commit?: (tx: ResourceTransaction) => Promise<unknown>,
) {
  const locked = deferred<number>(),
    release = deferred<void>();
  const blocker = db.transaction(async (tx) => {
    await lock(tx, f, target);
    const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
    locked.resolve(row.pid);
    await release.promise;
    if (commit) await commit(tx);
  });
  const pid = await Promise.race([
    locked.promise,
    blocker.then(() => {
      throw new Error("Blocker exited before locking");
    }),
  ]);
  const pending = batches.command(f.input).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await waitForLock(pid);
    await action();
  } finally {
    release.resolve();
    await blocker;
    await pending;
  }
  return pending;
}

for (const target of [
  "account",
  "selection-advisory",
  "actor",
  "collection",
  "member",
  "product",
  "grant",
  "selection",
  "build",
] as const) {
  it(`rejects revocation during the ${target} authority lock wait`, async () => {
    const f = await fixture();
    if (target === "selection") {
      await batches.command(f.input);
      const preview = await batches.preview(f.userId, f.collectionId, {
        mode: "latest",
        productIds: [f.productId],
      });
      f.input.command = {
        ...f.input.command,
        ...preview.choice,
        requestId: randomUUID(),
        previewDigest: preview.previewDigest,
      };
      f.input.receiptId += "_next";
      f.input.auditId += "_next";
    }
    const before = await state(f);
    expect(await duringWait(f, target, () => sessionRepository.delete(f.token))).toMatchObject({
      error: { code: "UNAUTHORIZED" },
    });
    expect(await state(f)).toEqual(before);
  }, 20000);
}

it("rechecks current collection status after waiting for its owner row", async () => {
  const f = await fixture(),
    before = await state(f);
  expect(
    await duringWait(
      f,
      "collection",
      async () => {},
      (tx) =>
        tx
          .update(libraryCollections)
          .set({
            status: "archived",
            revision: sql`${libraryCollections.revision} + 1`,
            updatedAt: sql`clock_timestamp()`,
          })
          .where(eq(libraryCollections.id, f.collectionId)),
    ),
  ).toMatchObject({ error: { code: "COLLECTION_ARCHIVED" } });
  expect(await state(f)).toEqual(before);
}, 20000);

it.each([false, true])(
  "rechecks session revocation after the session-row wait (replay=%s)",
  async (replay) => {
    const f = await fixture();
    if (replay) await batches.command(f.input);
    const before = await state(f);
    expect(
      await duringWait(
        f,
        "session",
        async () => {},
        (tx) => tx.delete(sessions).where(eq(sessions.id, f.sessionId)),
      ),
    ).toMatchObject({ error: { code: "UNAUTHORIZED" } });
    expect(await state(f)).toEqual(before);
  },
  20000,
);

for (const expiry of ["session", "entitlement", "license"] as const) {
  it(`rejects ${expiry} expiry during the session-row wait using fresh time`, async () => {
    const f = await fixture(expiry === "license" ? "license" : "entitlement"),
      before = await state(f),
      expiresAt = new Date(Date.now() + 2000);
    if (expiry === "session")
      await db.update(sessions).set({ expiresAt }).where(eq(sessions.id, f.sessionId));
    else if (expiry === "entitlement")
      await db.update(entitlements).set({ expiresAt }).where(eq(entitlements.id, f.accessId));
    else await db.update(licenses).set({ expiresAt }).where(eq(licenses.id, f.accessId));
    expect(
      await duringWait(f, "session", async () => {
        expect(Date.now()).toBeLessThan(expiresAt.getTime());
        await expect
          .poll(() => Date.now(), { timeout: 5000, interval: 10 })
          .toBeGreaterThanOrEqual(expiresAt.getTime());
      }),
    ).toMatchObject({
      error: { code: expiry === "session" ? "UNAUTHORIZED" : "SELECTION_BATCH_UNAVAILABLE" },
    });
    expect(await state(f)).toEqual(before);
  }, 20000);
}

it("rejects a new safe latest build published during the session wait", async () => {
  const f = await fixture(),
    before = await state(f);
  expect(
    await duringWait(f, "session", async () => {
      await db.insert(builds).values({
        id: `${f.buildId}_new`,
        productId: f.productId,
        version: "2.0.0",
        status: "published",
        scanStatus: "clean",
        scanner: "integration-test",
        scannedAt: new Date(),
        storageKey: `fixture/${f.key}_new.zip`,
        sha256Hash: "b".repeat(64),
        fileSizeBytes: 8,
      });
    }),
  ).toMatchObject({ error: { code: "SELECTION_BATCH_CHANGED" } });
  expect(await state(f)).toEqual(before);
}, 20000);

it("rejects a valid foreign caller before reading or changing another owner's batch", async () => {
  const f = await fixture(),
    other = await identity(),
    before = await state(f);
  await expect(
    batches.command({ ...f.input, userId: other.userId, currentToken: other.token }),
  ).rejects.toMatchObject({ statusCode: 404 });
  expect(await state(f)).toEqual(before);
});
