import { randomBytes } from "node:crypto";
import { count, eq, inArray, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  db,
  notificationRepository,
  notifications,
  sessionRepository,
  userRepository,
  webPushOutbox,
  webPushOutboxRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";

describe("Web Push outbox capacity gate", () => {
  it("serializes concurrent enqueue at capacity without rolling back inbox rows", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_push_capacity_${suffix}`;
    const sessionId = `ses_push_capacity_${suffix}`;
    const subscriptionId = `wps_push_capacity_${suffix}`;
    const notificationIds = Array.from(
      { length: 3 },
      (_, index) => `not_push_capacity_${suffix}_${index}`,
    );

    await userRepository.create({
      id: userId,
      email: `push_capacity_${suffix}@example.invalid`,
      username: `push_capacity_${suffix}`,
      displayName: "Push Capacity",
      role: "user",
    });
    await sessionRepository.create({
      id: sessionId,
      userId,
      token: `push-capacity-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await webPushSubscriptionRepository.upsert({
      id: subscriptionId,
      userId,
      sessionId,
      endpoint: `https://push.example.invalid/capacity-${suffix}`,
      p256dh: "capacity-key",
      auth: "capacity-auth",
      expirationAt: null,
    });

    const [originalGate] = await db.execute(sql`
      select capacity::integer as capacity
      from web_push_queue_gate
      where singleton = true
    `);
    if (!originalGate) {
      throw new Error("Web Push queue gate fixture is unavailable");
    }

    try {
      await db.execute(sql`
        delete from web_push_outbox
        where expires_at <= clock_timestamp()
      `);
      await db.execute(sql`
        update web_push_queue_gate
        set capacity = 2
        where singleton = true
      `);

      const results = await Promise.all(
        notificationIds.map((id) =>
          notificationRepository.createWithPushOutbox({
            id,
            recipientId: userId,
            title: "Capacity fixture",
            message: id,
            type: "system",
            category: "system",
          }),
        ),
      );

      expect(
        results.filter((result) => result.pushQueueState === "queued"),
      ).toHaveLength(2);
      expect(
        results.filter(
          (result) => result.pushQueueState === "saturated",
        ),
      ).toHaveLength(1);
      expect(
        results.every((result) => result.notification !== null),
      ).toBe(true);
      expect(
        results.reduce((sum, result) => sum + result.pushJobs, 0),
      ).toBe(2);

      const [inboxCount] = await db
        .select({ total: count() })
        .from(notifications)
        .where(inArray(notifications.id, notificationIds));
      expect(inboxCount?.total).toBe(3);

      const jobs = await db
        .select()
        .from(webPushOutbox)
        .where(inArray(webPushOutbox.notificationId, notificationIds));
      expect(jobs).toHaveLength(2);

      await expect(webPushOutboxRepository.stats()).resolves.toMatchObject({
        capacity: 2,
        pending: 2,
      });
    } finally {
      await db
        .delete(notifications)
        .where(inArray(notifications.id, notificationIds));
      await db.execute(sql`
        update web_push_queue_gate
        set capacity = ${Number(originalGate.capacity)}
        where singleton = true
      `);
    }
  });
});
