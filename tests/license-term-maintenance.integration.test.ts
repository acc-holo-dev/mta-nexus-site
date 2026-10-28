import { randomBytes, randomUUID } from "node:crypto";
import { and, count, eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import { db, licenseMaintenanceRepository as worker, userRepository } from "@nexus/db";
import {
  licenses,
  licenseTermEvents,
  notifications,
  notificationPreferences,
  products,
} from "../packages/db/src/schema";

// Disposable PostgreSQL migrated through 0054 only. These are explicit recorded
// license fixtures, without provider, purchase, payout or entitlement issuance.
async function fixture(expiry: Date | null, enabled = true) {
  const suffix = randomBytes(8).toString("hex"),
    userId = `usr_ltm_${suffix}`,
    productId = `prd_ltm_${suffix}`,
    licenseId = `lic_ltm_${suffix}`;
  await userRepository.create({
    id: userId,
    email: `${userId}@example.invalid`,
    username: userId,
    displayName: "Term fixture",
    role: "user",
  });
  await db.insert(products).values({
    id: productId,
    authorId: userId,
    title: "Term fixture",
    slug: productId.replaceAll("_", "-"),
    description: "Recorded license term fixture",
    type: "script",
    status: "draft",
  });
  await db.insert(licenses).values({
    id: licenseId,
    userId,
    productId,
    key: randomUUID(),
    model: "single_server",
    status: "active",
    expiresAt: expiry,
  });
  await db
    .insert(notificationPreferences)
    .values({ id: `npr_${suffix}`, userId, commerceEnabled: enabled });
  return { userId, licenseId };
}
it("expires a due parent once across concurrent workers and preserves its original term", async () => {
  const expiresAt = new Date("1900-01-01T00:00:00.000Z"),
    f = await fixture(expiresAt);
  await Promise.all([worker.runBatch(1), worker.runBatch(1)]);
  const [stored] = await db.select().from(licenses).where(eq(licenses.id, f.licenseId));
  expect(stored.status).toBe("expired");
  expect(stored.expiresAt?.getTime()).toBe(expiresAt.getTime());
  const events = await db
    .select()
    .from(licenseTermEvents)
    .where(eq(licenseTermEvents.licenseId, f.licenseId));
  expect(events).toHaveLength(1);
  expect(events[0]).toMatchObject({ event: "expired", notified: true });
  const [inbox] = await db
    .select({ total: count() })
    .from(notifications)
    .where(and(eq(notifications.recipientId, f.userId), eq(notifications.type, "license")));
  expect(inbox.total).toBe(1);
  await expect(
    db
      .update(licenseTermEvents)
      .set({ notified: false })
      .where(eq(licenseTermEvents.licenseId, f.licenseId)),
  ).rejects.toThrow();
  await expect(
    db.delete(licenseTermEvents).where(eq(licenseTermEvents.licenseId, f.licenseId)),
  ).rejects.toThrow();
});
it("honors commerce opt-out and leaves a license with no recorded expiry untouched", async () => {
  const due = await fixture(new Date("1890-01-01T00:00:00.000Z"), false),
    unknown = await fixture(null);
  await worker.runBatch(1);
  const [event] = await db
    .select()
    .from(licenseTermEvents)
    .where(eq(licenseTermEvents.licenseId, due.licenseId));
  expect(event).toMatchObject({ event: "expired", notified: false });
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, due.userId)),
  ).toHaveLength(0);
  const [stored] = await db.select().from(licenses).where(eq(licenses.id, unknown.licenseId));
  expect(stored).toMatchObject({ status: "active", expiresAt: null });
  expect(
    await db
      .select()
      .from(licenseTermEvents)
      .where(eq(licenseTermEvents.licenseId, unknown.licenseId)),
  ).toHaveLength(0);
});
it("requires the exact PostgreSQL term, rejects invented warning dates and deduplicates immutable events", async () => {
  const f = await fixture(null);
  await db
    .update(licenses)
    .set({ expiresAt: sql`clock_timestamp() + interval '1 day' + interval '0.123456 seconds'` })
    .where(eq(licenses.id, f.licenseId));
  await expect(
    db.insert(licenseTermEvents).values({
      licenseId: f.licenseId,
      event: "expiring",
      expiresAt: new Date(Date.now() + 86400000),
      notified: false,
    }),
  ).rejects.toThrow();
  const exact = {
    licenseId: f.licenseId,
    event: "expiring" as const,
    expiresAt: sql`(select expires_at from licenses where id = ${f.licenseId})`,
    notified: false,
  };
  await db.insert(licenseTermEvents).values(exact);
  await expect(db.insert(licenseTermEvents).values(exact)).rejects.toThrow();
  const [matched] = await db.execute(
    sql`select l.expires_at = e.expires_at as exact from licenses l join license_term_events e on e.license_id = l.id where l.id = ${f.licenseId}`,
  );
  expect(matched.exact).toBe(true);
});
it("rejects event processing for a non-finite historical term at the database boundary", async () => {
  const f = await fixture(null);
  await db
    .update(licenses)
    .set({ status: "expired", expiresAt: sql`'-infinity'::timestamptz` })
    .where(eq(licenses.id, f.licenseId));
  await expect(
    db.insert(licenseTermEvents).values({
      licenseId: f.licenseId,
      event: "expired",
      expiresAt: sql`'-infinity'::timestamptz`,
      notified: false,
    }),
  ).rejects.toThrow();
  expect(
    await db.select().from(licenseTermEvents).where(eq(licenseTermEvents.licenseId, f.licenseId)),
  ).toHaveLength(0);
});
