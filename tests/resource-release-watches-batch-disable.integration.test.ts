import { describe, expect, it } from "vitest";
import {
  and,
  auditEvents,
  db,
  entitlements,
  eq,
  fixture,
  resourceReleaseWatches,
  watches,
  worker,
} from "./helpers/resource-release-watches-harness";

describe("resource release watches: batch disable after lost access", () => {
  it("stops an exact watch batch after lost access, preserves notices/cursors and confirms retries without another audit", async () => {
    const a = await fixture(),
      b = await fixture();
    try {
      await a.release("1.0.0");
      await b.release("1.0.0");
      await a.start();
      await db.insert(entitlements).values({
        id: `ent_rw_batch_${a.key}`,
        subjectType: "user",
        subjectId: a.buyer,
        permission: "product.download",
        resourceId: b.id,
      });
      await watches.command({
        userId: a.buyer,
        currentToken: `tok_${a.buyer}`,
        productId: b.id,
        command: { enabled: true, expectedRevision: 0 },
        auditId: `aud_rw_second_${a.key}`,
      });
      await a.release("2.0.0");
      await worker.runBatch(100);
      const inbox = await a.inbox();
      expect(inbox).toHaveLength(1);
      const before = await db
        .select({
          productId: resourceReleaseWatches.productId,
          lastSequence: resourceReleaseWatches.lastSequence,
        })
        .from(resourceReleaseWatches)
        .where(eq(resourceReleaseWatches.userId, a.buyer))
        .orderBy(resourceReleaseWatches.productId);
      await db.delete(entitlements).where(eq(entitlements.subjectId, a.buyer));
      const command = {
        items: [
          { productId: a.id, expectedRevision: 1 },
          { productId: b.id, expectedRevision: 1 },
        ],
      };
      const result = await watches.disableBatch({
        userId: a.buyer,
        currentToken: `tok_${a.buyer}`,
        command,
        auditId: `aud_rw_stop_${a.key}`,
      });
      expect(result.changedCount).toBe(2);
      expect(result.items.every((item) => !item.enabled && item.revision === 2)).toBe(true);
      expect(
        (
          await watches.disableBatch({
            userId: a.buyer,
            currentToken: `tok_${a.buyer}`,
            command,
            auditId: `aud_rw_retry_${a.key}`,
          })
        ).changedCount,
      ).toBe(0);
      const audits = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.actorId, a.buyer),
            eq(auditEvents.action, "library.release_watches_disabled"),
          ),
        );
      expect(audits).toHaveLength(1);
      expect(
        await db
          .select({
            productId: resourceReleaseWatches.productId,
            lastSequence: resourceReleaseWatches.lastSequence,
          })
          .from(resourceReleaseWatches)
          .where(eq(resourceReleaseWatches.userId, a.buyer))
          .orderBy(resourceReleaseWatches.productId),
      ).toEqual(before);
      await a.release("3.0.0");
      await worker.runBatch(100);
      expect(await a.inbox()).toEqual(inbox);
    } finally {
      await db.delete(auditEvents).where(eq(auditEvents.actorId, a.buyer));
      await db.delete(entitlements).where(eq(entitlements.subjectId, a.buyer));
      await a.cleanup();
      await b.cleanup();
    }
  });
});
