import { createHash, randomUUID } from "node:crypto";
import {
  auditEvents,
  librarySelectionBatchesRepository as batches,
  builds,
  db,
  entitlementRepository,
  entitlements,
  libraryCollectionItems,
  libraryCollections,
  librarySelectionBatchReceipts,
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
import { expect } from "vitest";
import type { ResourceTransaction } from "../../site/packages/db/src/transaction";

export {
  batches,
  builds,
  createHash,
  db,
  entitlements,
  eq,
  libraryCollections,
  licenses,
  randomUUID,
  sessionRepository,
  sessions,
  sql,
};

/** Create a disposable user with a live initiating session. */
export async function identity() {
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

/** Seed product, access, collection membership, and a ready selection-batch command. */
export async function fixture(access: "entitlement" | "license" = "entitlement") {
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

export type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Read selections, receipts, and audits owned by the fixture actor. */
export async function state(f: Fixture) {
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

export type Target =
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

/**
 * Hold a target lock, start a selection-batch command that must wait, run `action`
 * during the wait, optionally mutate inside the blocker before release.
 */
export async function duringWait(
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
