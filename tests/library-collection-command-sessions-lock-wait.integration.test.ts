import { createHash, randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  and,
  behindLock,
  db,
  entitlements,
  eq,
  fixture,
  libraryCollections,
  products,
  sessionRepository,
  sessions,
  sql,
} from "./helpers/library-collection-command-sessions-harness";

describe("library collection command sessions: lock-wait session rechecks", () => {
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
                : tx
                    .select()
                    .from(entitlements)
                    .where(eq(entitlements.id, f.grantId))
                    .for("update"),
          () =>
            f.command(
              {
                requestId: randomUUID(),
                action: "add",
                productId: f.productId,
                expectedRevision: 1,
              },
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
});
