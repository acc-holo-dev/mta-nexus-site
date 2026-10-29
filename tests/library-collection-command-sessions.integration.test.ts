import { createHash, randomUUID } from "node:crypto";
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
import { expect, it } from "vitest";
import { applyLibraryMembershipBatch } from "../packages/db/src/repositories/library-membership-batches";

// Disposable PostgreSQL only. Tokens enter via the public mutation repositories.
async function fixture() {
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

it("rejects revoked, expired and foreign initiating tokens for new commands and whole membership batches even with another live session", async () => {
  const f = await fixture(),
    before = await f.snapshot();
  await sessionRepository.delete(f.currentToken);
  for (const token of [f.currentToken, f.expired, f.foreign, ""]) {
    await expect(f.batch(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      f.command({ requestId: randomUUID(), action: "create", name: "Denied" }, undefined, token),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  }
  expect(await f.snapshot()).toEqual(before);
});

it("reauthenticates immutable command and batch replays, while a surviving initiating session can replay the same receipts", async () => {
  const f = await fixture(),
    body = {
      requestId: randomUUID(),
      action: "rename" as const,
      name: "Saved",
      expectedRevision: 2,
    };
  const saved = await f.command(body, f.source);
  // The prepared membership proof must use the successor source revision.
  const changes = [
    { collectionId: f.source, expectedRevision: 3, wasInCollection: true, inCollection: false },
    {
      collectionId: f.destination,
      expectedRevision: 1,
      wasInCollection: false,
      inCollection: true,
    },
  ];
  const requestId = randomUUID();
  const batch = (currentToken: string) =>
    applyLibraryMembershipBatch({
      userId: f.userId,
      currentToken,
      productId: f.productId,
      command: { requestId, changes },
      receiptId: `lmb_${randomUUID()}`,
      auditId: `aud_${randomUUID()}`,
      children: changes.map(({ collectionId }) => ({
        collectionId,
        receiptId: `lcr_${randomUUID()}`,
        auditId: `aud_${randomUUID()}`,
      })),
    });
  const savedBatch = await batch(f.currentToken),
    before = await f.snapshot();
  await sessionRepository.delete(f.currentToken);
  for (const token of [f.currentToken, f.expired, f.foreign]) {
    await expect(batch(token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(f.command(body, f.source, token)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  }
  expect(await f.command(body, f.source, f.survivor)).toEqual({ ...saved, replayed: true });
  expect(await batch(f.survivor)).toEqual({ ...savedBatch, replayed: true });
  expect(await f.snapshot()).toEqual(before);
});

it("guards each collection command preparation path before its first protected write", async () => {
  const f = await fixture(),
    preview = await libraryCollectionsRepository.copyPreview(f.userId, f.source);
  const archived = (
    await f.command({ requestId: randomUUID(), action: "create", name: "Archived" })
  ).receipt.collection.id;
  await f.command({ requestId: randomUUID(), action: "archive", expectedRevision: 1 }, archived);
  const before = await f.snapshot();
  await sessionRepository.delete(f.currentToken);
  const existing = { expectedRevision: 1, requestId: randomUUID() };
  const operations: [LibraryCollectionCommand, string | undefined][] = [
    [
      {
        action: "duplicate",
        name: "Copy",
        sourceCollectionId: f.source,
        expectedRevision: 2,
        expectedItemCount: 1,
        sourceDigest: preview.sourceDigest,
        requestId: randomUUID(),
      },
      undefined,
    ],
    [{ ...existing, action: "rename", name: "Denied" }, f.destination],
    [{ ...existing, action: "archive" }, f.destination],
    [{ ...existing, action: "restore", expectedRevision: 2 }, archived],
    [{ ...existing, action: "add", productId: f.productId }, f.destination],
    [{ ...existing, action: "add-many", productIds: [f.productId] }, f.destination],
    [{ ...existing, action: "remove", productId: f.productId, expectedRevision: 2 }, f.source],
    [
      { ...existing, action: "remove-many", productIds: [f.productId], expectedRevision: 2 },
      f.source,
    ],
    [
      {
        ...existing,
        action: "copy-items",
        sourceCollectionId: f.source,
        expectedSourceRevision: 2,
        productIds: [f.productId],
      },
      f.destination,
    ],
    [
      {
        ...existing,
        action: "move-items",
        sourceCollectionId: f.source,
        expectedSourceRevision: 2,
        productIds: [f.productId],
      },
      f.destination,
    ],
    [
      {
        ...existing,
        action: "reconcile-items",
        addProductIds: [f.productId],
        removeProductIds: [],
      },
      f.destination,
    ],
  ];
  for (const [body, id] of operations)
    await expect(f.command(body, id)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(await f.snapshot()).toEqual(before);
});

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function behindLock<T>(
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

it("rejects revocation committed during collection, product and grant waits without writing a successor or receipt", async () => {
  const f = await fixture(),
    before = await f.snapshot();
  for (const kind of ["collection", "product", "grant"] as const) {
    const token = `${f.currentToken}_${kind}`;
    await sessionRepository.create({
      id: `ses_${randomUUID()}`,
      userId: f.userId,
      token,
      expiresAt: new Date(Date.now() + 3600000),
    });
    await expect(
      behindLock(
        (tx) =>
          kind === "collection"
            ? tx
                .select()
                .from(libraryCollections)
                .where(eq(libraryCollections.id, f.destination))
                .for("update")
            : kind === "product"
              ? tx.select().from(products).where(eq(products.id, f.productId)).for("update")
              : tx.select().from(entitlements).where(eq(entitlements.id, f.grantId)).for("update"),
        () =>
          f.command(
            { requestId: randomUUID(), action: "add", productId: f.productId, expectedRevision: 1 },
            f.destination,
            token,
          ),
        () => sessionRepository.delete(token),
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  }
  expect(await f.snapshot()).toEqual(before);
});

it("locks one batch session only after all child preparation and rolls back both children when revoked during its product wait", async () => {
  const f = await fixture(),
    before = await f.snapshot();
  await expect(
    behindLock(
      (tx) => tx.select().from(products).where(eq(products.id, f.productId)).for("update"),
      () => f.batch(),
      () => sessionRepository.delete(f.currentToken),
    ),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(await f.snapshot()).toEqual(before);
  const results = await Promise.all([f.batch(f.survivor), f.batch(f.survivor)]);
  expect(results.filter((result) => !result.replayed)).toHaveLength(1);
  expect(results[0]?.receipt.children).toHaveLength(2);
});

it("rejects a session that expires while its row lock is pending and rechecks finite grants after that wait", async () => {
  const f = await fixture(),
    before = await f.snapshot();
  await expect(
    behindLock(
      (tx) =>
        tx
          .update(sessions)
          .set({ expiresAt: sql`clock_timestamp()+interval '150 milliseconds'` })
          .where(eq(sessions.userId, f.userId)),
      () =>
        f.command(
          { requestId: randomUUID(), action: "rename", name: "Too late", expectedRevision: 1 },
          f.destination,
        ),
      () => new Promise((resolve) => setTimeout(resolve, 200)),
    ),
  ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  const token = `${f.currentToken}_grant_wait`;
  await sessionRepository.create({
    id: `ses_${randomUUID()}`,
    userId: f.userId,
    token,
    expiresAt: new Date(Date.now() + 3600000),
  });
  await db
    .update(entitlements)
    .set({ expiresAt: sql`clock_timestamp()+interval '500 milliseconds'` })
    .where(eq(entitlements.id, f.grantId));
  await expect(
    behindLock(
      (tx) =>
        tx
          .select()
          .from(sessions)
          .where(
            and(
              eq(sessions.userId, f.userId),
              eq(sessions.token, createHash("sha256").update(token).digest("hex")),
            ),
          )
          .for("update"),
      () =>
        f.command(
          {
            requestId: randomUUID(),
            action: "add-many",
            productIds: [f.productId],
            expectedRevision: 1,
          },
          f.destination,
          token,
        ),
      () => new Promise((resolve) => setTimeout(resolve, 600)),
    ),
  ).rejects.toMatchObject({ code: "COLLECTION_ACCESS_CHANGED" });
  expect(await f.snapshot()).toEqual(before);
});
