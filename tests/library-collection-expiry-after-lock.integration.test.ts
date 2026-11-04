import { randomUUID } from "node:crypto";
import {
  auditEvents,
  db,
  libraryCollectionItems,
  libraryCollectionReceipts,
  libraryCollections,
  libraryCollectionsRepository,
  libraryMembershipBatchReceipts,
  sessionRepository,
  userRepository,
  users,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { applyLibraryMembershipBatch } from "../packages/db/src/repositories/library-membership-batches";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

// Disposable database: the blocker occupies the audit primary key and rolls back.
// The waiting INSERT happens after the collection command locks its session.
async function waitForBlocker(pid: number) {
  const deadline = Date.now() + 4_000;
  while (Date.now() < deadline) {
    const [row] = await db.execute<{ blocked: boolean }>(
      sql`select exists (select 1 from pg_stat_activity where datname=current_database() and ${pid} = any(pg_blocking_pids(pid))) as blocked`,
    );
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("The operation did not reach the blocked audit insert");
}

it.each(["collection", "batch"] as const)(
  "rolls back %s when its session expires during a post-session write",
  async (kind) => {
    const key = randomUUID().replaceAll("-", "");
    const userId = `usr_expiry_${key}`,
      collectionId = `lcol_${key}`,
      productId = `prd_${key}`,
      token = `token_${key}`,
      auditId = `aud_${key}`;
    const locked = deferred(),
      release = deferred();
    let blocker: Promise<void> | undefined;
    let pending: Promise<unknown> | undefined;
    try {
      await userRepository.create({
        id: userId,
        username: `expiry_${key}`,
        email: `${key}@nexus.test`,
        displayName: "Expiry fixture",
        role: "user",
      });
      if (kind === "batch") {
        await db.insert(libraryCollections).values({ id: collectionId, userId, name: "Fixture" });
        await db.insert(libraryCollectionItems).values({ collectionId, productId });
      }
      let pid = 0;
      blocker = db
        .transaction(async (tx) => {
          const [row] = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
          pid = Number(row.pid);
          await tx.insert(auditEvents).values({
            id: auditId,
            actorId: userId,
            actorType: "user",
            action: "fixture.block",
            targetType: "fixture",
            targetId: userId,
          });
          locked.resolve();
          await release.promise;
          throw new Error("rollback fixture lock");
        })
        .catch((error) => {
          if (!(error instanceof Error) || error.message !== "rollback fixture lock") throw error;
        });
      await Promise.race([locked.promise, blocker]);
      const expiresAt = new Date(Date.now() + 2_000);
      await sessionRepository.create({ id: `ses_${key}`, userId, token, expiresAt });
      pending = (
        kind === "collection"
          ? libraryCollectionsRepository.command({
              userId,
              currentToken: token,
              newCollectionId: collectionId,
              receiptId: `lcr_${key}`,
              auditId,
              command: { requestId: randomUUID(), action: "create", name: "Fixture" },
            })
          : applyLibraryMembershipBatch({
              userId,
              currentToken: token,
              productId,
              receiptId: `lmb_${key}`,
              auditId: `aud_parent_${key}`,
              children: [{ collectionId, receiptId: `lcr_${key}`, auditId }],
              command: {
                requestId: randomUUID(),
                changes: [
                  { collectionId, expectedRevision: 1, wasInCollection: true, inCollection: false },
                ],
              },
            })
      ).then(
        () => null,
        (error: unknown) => error,
      );
      try {
        await waitForBlocker(pid);
        const delay = Math.max(0, expiresAt.getTime() - Date.now() + 100);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } finally {
        release.resolve();
      }
      await blocker;
      expect(await pending).toMatchObject({ code: "UNAUTHORIZED" });
      const collections = await db
        .select()
        .from(libraryCollections)
        .where(eq(libraryCollections.userId, userId));
      expect(collections).toHaveLength(kind === "batch" ? 1 : 0);
      if (kind === "batch") {
        expect(collections[0].revision).toBe(1);
        expect(
          await db
            .select()
            .from(libraryCollectionItems)
            .where(eq(libraryCollectionItems.collectionId, collectionId)),
        ).toHaveLength(1);
      }
      expect(
        await db
          .select()
          .from(libraryCollectionReceipts)
          .where(eq(libraryCollectionReceipts.userId, userId)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(libraryMembershipBatchReceipts)
          .where(eq(libraryMembershipBatchReceipts.userId, userId)),
      ).toHaveLength(0);
      expect(
        await db.select().from(auditEvents).where(eq(auditEvents.actorId, userId)),
      ).toHaveLength(0);
    } finally {
      release.resolve();
      await blocker?.catch(() => {});
      await pending?.catch(() => {});
      await db.delete(auditEvents).where(eq(auditEvents.actorId, userId));
      // The history guards permit deletion only through the fixture user's cascade.
      await db.delete(users).where(eq(users.id, userId));
    }
  },
);
