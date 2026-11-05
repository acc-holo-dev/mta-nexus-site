import { randomUUID } from "node:crypto";
import {
  builds,
  resourceCartRepository as cart,
  licenseControlsRepository as controls,
  db,
  entitlements,
  products,
  resourceAcquisitionEvents,
  resourceCartAcquisitions,
  resourceCartItems,
  sessionRepository,
} from "@nexus/db";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  block,
  fixture,
  id,
  moderation,
  setupLicenseCommandSession,
  snapshot,
  trackProduct,
  waitForLock,
} from "./helpers/license-command-session-harness";

setupLicenseCommandSession();

describe("license command session: competing cart completion with shared session", () => {
  for (const scenario of ["owner", "moderator", "revoked"] as const) {
    it(`completes a two-resource cart competing with a ${scenario} license command using the same session`, async () => {
      const f = await fixture();
      const firstId = id("prd_a_cart");
      trackProduct(firstId);
      await db.insert(products).values({
        id: firstId,
        authorId: f.userId,
        title: "First safe resource",
        description: "Safe fixture",
        slug: firstId,
        type: "script",
        status: "published",
      });
      await db.insert(builds).values({
        id: id("bld"),
        productId: firstId,
        version: "1.0.0",
        status: "published",
        storageKey: `fixture/${firstId}.zip`,
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 7,
        scanStatus: "clean",
        scanner: "integration-test",
        scannedAt: new Date(),
      });
      for (const productId of [firstId, f.productId]) await cart.add(f.userId, productId, f.token);
      const review = await cart.review(f.userId);
      if (!review.reviewDigest) throw new Error("Missing review digest");
      const cartInput = {
        userId: f.userId,
        currentToken: f.token,
        requestId: randomUUID(),
        productIds: [firstId, f.productId],
        entitlementIds: [id("ent"), id("ent")],
        auditId: id("aud"),
        reviewDigest: review.reviewDigest,
      };
      const before = await snapshot(f);
      const blocker = await block(f, "license_runtime_bindings");
      const command = (
        scenario === "moderator" ? controls.moderate(moderation(f)) : controls.ownerCommand(f.input)
      ).then(
        (value) => ({ value }),
        (error: unknown) => ({ error }),
      );
      let acquisition: ReturnType<typeof cart.acquire> | undefined;
      let outcome: Promise<{ value: unknown } | { error: unknown }> | undefined;
      try {
        // The real license command holds the later cart license and awaits its binding.
        await waitForLock("license_runtime_bindings");
        acquisition = cart.acquire(cartInput);
        outcome = acquisition.then(
          (value) => ({ value }),
          (error: unknown) => ({ error }),
        );
        // The cart must await all later access rows before ever taking its session.
        await waitForLock("licenses", "share");
        if (scenario === "revoked") await sessionRepository.delete(f.token);
      } finally {
        await blocker.release();
      }
      const [commandResult, cartResult] = await Promise.all([command, outcome]);
      if (scenario === "revoked") {
        expect(commandResult).toMatchObject({ error: { code: "UNAUTHORIZED" } });
        expect(cartResult).toMatchObject({ error: { code: "UNAUTHORIZED" } });
        expect(await snapshot(f)).toEqual(before);
        const writes = await Promise.all([
          db.select().from(entitlements).where(eq(entitlements.subjectId, f.userId)),
          db
            .select()
            .from(resourceAcquisitionEvents)
            .where(eq(resourceAcquisitionEvents.userId, f.userId)),
          db
            .select()
            .from(resourceCartAcquisitions)
            .where(eq(resourceCartAcquisitions.userId, f.userId)),
        ]);
        for (const rows of writes) expect(rows).toHaveLength(0);
        expect(
          await db.select().from(resourceCartItems).where(eq(resourceCartItems.userId, f.userId)),
        ).toHaveLength(2);
      } else {
        expect(commandResult).toHaveProperty("value");
        const saved = await snapshot(f);
        expect(saved.license[0].expiresAt).toEqual(f.expiresAt);
        expect(saved.binding[0].tokenDigest).toBeNull();
        expect(saved.audit).toMatchObject([
          {
            actorId: f.userId,
            actorType: scenario === "moderator" ? "admin" : "user",
            action: scenario === "moderator" ? "license.suspended" : "license.token_revoked",
            details: { previousStatus: "active", termChanged: false },
          },
        ]);
        expect(cartResult).toMatchObject({
          value: {
            acquired: [
              { productId: firstId, alreadyClaimed: false },
              { productId: f.productId, alreadyClaimed: scenario === "owner" },
            ],
          },
        });
        const result = await acquisition;
        expect(await cart.acquire(cartInput)).toEqual(result);
        const [receipt] = await db
          .select()
          .from(resourceCartAcquisitions)
          .where(
            and(
              eq(resourceCartAcquisitions.userId, f.userId),
              eq(resourceCartAcquisitions.requestId, cartInput.requestId),
            ),
          );
        expect(receipt.reviewDigest).toBe(review.reviewDigest);
        expect(receipt.reviewSnapshot).toMatchObject([
          { productId: firstId, accessSource: "entitlement", recordedExpiresAt: null },
          {
            productId: f.productId,
            accessSource: scenario === "owner" ? "license" : "entitlement",
            recordedExpiresAt: scenario === "owner" ? f.expiresAt.toISOString() : null,
          },
        ]);
        const events = await db
          .select()
          .from(resourceAcquisitionEvents)
          .where(eq(resourceAcquisitionEvents.userId, f.userId))
          .orderBy(asc(resourceAcquisitionEvents.productId));
        expect(events).toHaveLength(scenario === "owner" ? 1 : 2);
      }
    }, 20000);
  }
});
