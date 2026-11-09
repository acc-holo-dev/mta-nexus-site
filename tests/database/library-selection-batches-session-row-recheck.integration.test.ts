import { describe, expect, it } from "vitest";
import {
  batches,
  builds,
  db,
  duringWait,
  entitlements,
  eq,
  fixture,
  libraryCollections,
  licenses,
  sessions,
  sql,
  state,
} from "../helpers/library-selection-batches-session-harness";

describe("library selection batches session: lock-wait rechecks", () => {
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
});
