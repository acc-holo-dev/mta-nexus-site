import {
  auditEvents,
  db,
  notificationPreferences,
  notifications,
  sessionRepository,
  supportActivityRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";
import { eq, sql } from "drizzle-orm";
import { expect, it } from "vitest";
import {
  audit,
  cases,
  fixture,
  id,
  initiatingToken,
  randomUUID,
} from "./helpers/support-workspace-persistence-harness";

it("paginates tied microsecond status events once and excludes raw private details", async () => {
  const f = await fixture(),
    events = Array.from({ length: 43 }, () => ({
      ...audit(f.supportCase.id, f.staff.id),
      actorType: "admin" as const,
      details: { from: "open", to: "resolved", body: "Private audit context" },
      createdAt: sql`'2026-10-11T00:00:00.123456Z'::timestamptz`,
    }));
  await db.insert(auditEvents).values(events);
  const seen: string[] = [];
  let before: string | undefined;
  do {
    const page = await supportActivityRepository.history(f.supportCase.id, f.owner.id, before);
    seen.push(...page.items.map((item) => item.id));
    expect(JSON.stringify(page)).not.toContain("Private audit context");
    before = page.nextCursor ?? undefined;
  } while (before);
  expect(new Set(seen).size).toBe(43);
  expect(seen).toHaveLength(43);
});

it("queues status push delivery in the same transaction as the receipt", async () => {
  const f = await fixture(),
    sessionId = id("ses"),
    subscriptionId = id("wps");
  await sessionRepository.create({
    id: sessionId,
    userId: f.owner.id,
    token: randomUUID(),
    expiresAt: new Date(Date.now() + 3_600_000),
  });
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId: f.owner.id,
    sessionId,
    endpoint: `https://push.example.invalid/${randomUUID()}`,
    p256dh: "fixture-key",
    auth: "fixture-auth",
    expirationAt: null,
  });
  await cases.updateStatus(
    f.supportCase.id,
    "resolved",
    audit(f.supportCase.id, f.owner.id),
    "open",
    await initiatingToken(f.owner.id),
    f.supportCase.updatedAt,
  );
  const [notice] = await db
    .select()
    .from(notifications)
    .where(eq(notifications.recipientId, f.owner.id));
  expect(
    await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id)),
  ).toEqual([expect.objectContaining({ subscriptionId, attempts: 0 })]);
});

it("honors persisted system-notification opt-out while keeping the authoritative transition", async () => {
  const f = await fixture();
  await db
    .insert(notificationPreferences)
    .values({ id: id("npr"), userId: f.owner.id, systemEnabled: false });
  expect(
    (
      await cases.updateStatus(
        f.supportCase.id,
        "resolved",
        audit(f.supportCase.id, f.owner.id),
        "open",
        await initiatingToken(f.owner.id),
        f.supportCase.updatedAt,
      )
    )?.status,
  ).toBe("resolved");
  expect(
    await db.select().from(notifications).where(eq(notifications.recipientId, f.owner.id)),
  ).toEqual([]);
});
