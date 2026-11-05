import { describe, expect, it } from "vitest";
import {
  and,
  db,
  eq,
  fixture,
  notifications,
  randomUUID,
  sessionRepository,
  setupOrganizationGovernancePersistence,
  transfer,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "./helpers/organization-governance-persistence-harness";

setupOrganizationGovernancePersistence();

describe("organization governance persistence: push outbox", () => {
  it("queues the ownership notice for an active push subscription in the same authoritative transaction", async () => {
    const f = await fixture(),
      sessionId = `ses_${randomUUID()}`,
      subscriptionId = `wps_${randomUUID()}`;
    await sessionRepository.create({
      id: sessionId,
      userId: f.target.id,
      token: `org-session-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 3_600_000),
    });
    await webPushSubscriptionRepository.upsert({
      id: subscriptionId,
      userId: f.target.id,
      sessionId,
      endpoint: `https://push.example.invalid/org-${randomUUID()}`,
      p256dh: "fixture-key",
      auth: "fixture-auth",
      expirationAt: null,
    });
    await transfer(f);
    const [notice] = await db
      .select()
      .from(notifications)
      .where(
        and(
          eq(notifications.recipientId, f.target.id),
          eq(notifications.message, `Organization ${f.org.id}: ownership_gained.`),
        ),
      );
    expect(
      await db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notice.id)),
    ).toEqual([expect.objectContaining({ subscriptionId, attempts: 0 })]);
  });
});
