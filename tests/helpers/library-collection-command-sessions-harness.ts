import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  entitlements,
  libraryCollectionItems,
  libraryCollectionReceipts,
  libraryCollections,
  libraryCollectionsRepository,
  libraryMembershipBatchReceipts,
  products,
  sessionRepository,
  sessions,
  userRepository,
} from "@nexus/db";
import type { LibraryCollectionCommand } from "@nexus/domain";
import { and, eq, sql } from "drizzle-orm";
import { expect } from "vitest";
import { applyLibraryMembershipBatch } from "../../packages/db/src/repositories/library-membership-batches";

export type { LibraryCollectionCommand };
export {
  and,
  applyLibraryMembershipBatch,
  db,
  entitlements,
  eq,
  libraryCollections,
  libraryCollectionsRepository,
  products,
  sessionRepository,
  sessions,
  sql,
};

// Disposable PostgreSQL only. Tokens enter via the public mutation repositories.
export async function fixture() {
  const key = randomUUID().replaceAll("-", ""),
    userId = `usr_cs_${key}`,
    other = `usr_cs_other_${key}`;
  for (const id of [userId, other])
    await userRepository.create({
      id,
      email: `${id}@example.invalid`,
      username: id,
      displayName: id,
      role: "user",
    });
  const currentToken = `tok_${userId}`,
    survivor = `${currentToken}_survivor`,
    expired = `${currentToken}_expired`,
    foreign = `tok_${other}`;
  for (const [id, owner, token, expiresAt] of [
    [`ses_${userId}`, userId, currentToken, new Date(Date.now() + 3600000)],
    [`ses_survivor_${key}`, userId, survivor, new Date(Date.now() + 3600000)],
    [`ses_expired_${key}`, userId, expired, new Date(Date.now() - 1000)],
    [`ses_${other}`, other, foreign, new Date(Date.now() + 3600000)],
  ] as const)
    await sessionRepository.create({ id, userId: owner, token, expiresAt });
  const productId = `prd_cs_${key}`,
    grantId = `ent_cs_${key}`;
  await db.insert(products).values({
    id: productId,
    authorId: other,
    slug: productId,
    title: "Session fixture",
    description: "Fixture",
    type: "script",
    status: "draft",
    price: 0,
  });
  await db.insert(entitlements).values({
    id: grantId,
    subjectType: "user",
    subjectId: userId,
    resourceId: productId,
    permission: "product.download",
  });
  const command = (body: LibraryCollectionCommand, collectionId?: string, token = currentToken) =>
    libraryCollectionsRepository.command({
      userId,
      currentToken: token,
      collectionId,
      command: body,
      newCollectionId: `lcol_${randomUUID()}`,
      receiptId: `lcr_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
    });
  const source = (await command({ requestId: randomUUID(), action: "create", name: "Source" }))
    .receipt.collection.id;
  const destination = (
    await command({ requestId: randomUUID(), action: "create", name: "Destination" })
  ).receipt.collection.id;
  await command({ requestId: randomUUID(), action: "add", productId, expectedRevision: 1 }, source);
  const batchCommand = {
    requestId: randomUUID(),
    changes: [
      { collectionId: source, expectedRevision: 2, wasInCollection: true, inCollection: false },
      {
        collectionId: destination,
        expectedRevision: 1,
        wasInCollection: false,
        inCollection: true,
      },
    ],
  };
  const batch = (token = currentToken) =>
    applyLibraryMembershipBatch({
      userId,
      currentToken: token,
      productId,
      command: batchCommand,
      receiptId: `lmb_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
      children: batchCommand.changes.map(({ collectionId }) => ({
        collectionId,
        receiptId: `lcr_${randomUUID()}`,
        auditId: `aud_${randomUUID()}`,
      })),
    });
  const snapshot = async () => ({
    collections: await db
      .select()
      .from(libraryCollections)
      .where(eq(libraryCollections.userId, userId))
      .orderBy(libraryCollections.id),
    members: await db
      .select()
      .from(libraryCollectionItems)
      .where(
        sql`${libraryCollectionItems.collectionId} IN (SELECT id FROM ${libraryCollections} WHERE user_id=${userId})`,
      )
      .orderBy(libraryCollectionItems.collectionId),
    receipts: await db
      .select()
      .from(libraryCollectionReceipts)
      .where(eq(libraryCollectionReceipts.userId, userId))
      .orderBy(libraryCollectionReceipts.id),
    batches: await db
      .select()
      .from(libraryMembershipBatchReceipts)
      .where(eq(libraryMembershipBatchReceipts.userId, userId))
      .orderBy(libraryMembershipBatchReceipts.id),
    audits: await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorId, userId))
      .orderBy(auditEvents.id),
  });
  return {
    userId,
    other,
    currentToken,
    survivor,
    expired,
    foreign,
    productId,
    grantId,
    source,
    destination,
    command,
    batch,
    snapshot,
  };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Hold a row lock, run an operation that must wait, mutate during the wait, then release. */
export async function behindLock<T>(
  lock: (tx: Transaction) => Promise<unknown>,
  operation: () => Promise<T>,
  duringWait: () => Promise<void>,
) {
  let unlock!: () => void, ready!: (pid: number) => void;
  const gate = new Promise<void>((resolve) => {
    unlock = resolve;
  });
  const readyPromise = new Promise<number>((resolve) => {
    ready = resolve;
  });
  const held = db.transaction(async (tx) => {
    await lock(tx);
    const [row] = await tx.execute<{ pid: number }>(sql`SELECT pg_backend_pid() AS pid`);
    if (!row) throw Error("Missing blocker PID");
    ready(row.pid);
    await gate;
  });
  const pid = await readyPromise,
    pending = operation().then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
  try {
    let blocked = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      const [row] = await db.execute<{ blocked: boolean }>(
        sql`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND ${pid}=ANY(pg_blocking_pids(pid))) AS blocked`,
      );
      if (row?.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(blocked).toBe(true);
    await duringWait();
  } finally {
    unlock();
    await held;
  }
  const result = await pending;
  if ("error" in result) throw result.error;
  return result.value;
}
