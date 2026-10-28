import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  db,
  notificationRepository,
  notifications,
  sessionRepository,
  userRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
} from "@nexus/db";

describe("durable Web Push outbox", () => {
  it("commits inbox notification and one job per active subscription atomically", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_push_outbox_${suffix}`;
    const activeSessionId = `ses_push_outbox_active_${suffix}`;
    const expiredSessionId = `ses_push_outbox_expired_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `push_outbox_${suffix}@example.invalid`,
      username: `push_outbox_${suffix}`,
      displayName: "Push Outbox",
      role: "user",
    });
    await sessionRepository.create({
      id: activeSessionId,
      userId,
      token: `push-outbox-active-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await sessionRepository.create({
      id: expiredSessionId,
      userId,
      token: `push-outbox-expired-${suffix}`,
      expiresAt: new Date(Date.now() - 60 * 1000),
    });

    for (const [id, sessionId, expirationAt] of [
      [`wps_outbox_a_${suffix}`, activeSessionId, null],
      [`wps_outbox_b_${suffix}`, activeSessionId, new Date(Date.now() + 30 * 60 * 1000)],
      [`wps_outbox_expired_session_${suffix}`, expiredSessionId, null],
      [`wps_outbox_expired_sub_${suffix}`, activeSessionId, new Date(Date.now() - 30 * 60 * 1000)],
    ] as const) {
      await webPushSubscriptionRepository.upsert({
        id,
        userId,
        sessionId,
        endpoint: `https://push.example.invalid/${id}`,
        p256dh: `key-${id}`,
        auth: `auth-${id}`,
        expirationAt,
      });
    }

    const notificationId = `not_push_outbox_${suffix}`;
    const created = await notificationRepository.createWithPushOutbox({
      id: notificationId,
      recipientId: userId,
      title: "Durable push",
      message: "Outbox integration",
      type: "system",
      category: "system",
    });

    expect(created.notification).toMatchObject({
      id: notificationId,
      recipientId: userId,
    });
    expect(created.pushJobs).toBe(2);
    expect(created.pushQueueState).toBe("queued");

    const jobs = await db
      .select()
      .from(webPushOutbox)
      .where(eq(webPushOutbox.notificationId, notificationId));
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.subscriptionId).sort()).toEqual(
      [`wps_outbox_a_${suffix}`, `wps_outbox_b_${suffix}`].sort(),
    );
    expect(jobs.every((job) => job.attempts === 0)).toBe(true);
  });

  it("preference suppression creates neither inbox row nor push job", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_push_suppressed_${suffix}`;
    const sessionId = `ses_push_suppressed_${suffix}`;
    const notificationId = `not_push_suppressed_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `push_suppressed_${suffix}@example.invalid`,
      username: `push_suppressed_${suffix}`,
      displayName: "Push Suppressed",
      role: "user",
    });
    await sessionRepository.create({
      id: sessionId,
      userId,
      token: `push-suppressed-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await webPushSubscriptionRepository.upsert({
      id: `wps_push_suppressed_${suffix}`,
      userId,
      sessionId,
      endpoint: `https://push.example.invalid/suppressed-${suffix}`,
      p256dh: "key",
      auth: "auth",
      expirationAt: null,
    });
    await notificationRepository.updatePreferences(userId, {
      followsEnabled: false,
    });

    await expect(
      notificationRepository.createWithPushOutbox({
        id: notificationId,
        recipientId: userId,
        title: "Follow",
        message: "Suppressed follow",
        type: "system",
        category: "follow",
      }),
    ).resolves.toEqual({
      notification: null,
      pushJobs: 0,
      pushQueueState: "no_subscriptions",
    });

    const [notificationRows, jobs] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(and(eq(notifications.id, notificationId), eq(notifications.recipientId, userId))),
      db.select().from(webPushOutbox).where(eq(webPushOutbox.notificationId, notificationId)),
    ]);
    expect(notificationRows).toEqual([]);
    expect(jobs).toEqual([]);
  });
});
