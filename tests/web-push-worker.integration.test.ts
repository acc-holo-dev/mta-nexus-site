import { randomBytes } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  db,
  notificationRepository,
  sessionRepository,
  userRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
  webPushWorkerRepository,
} from "@nexus/db";

async function fixture(label: string) {
  const suffix = `${label}_${randomBytes(5).toString("hex")}`;
  const userId = `usr_wpw_${suffix}`;
  const sessionId = `ses_wpw_${suffix}`;
  const subscriptionId = `wps_wpw_${suffix}`;
  const notificationId = `not_wpw_${suffix}`;

  await userRepository.create({
    id: userId,
    email: `wpw_${suffix}@example.invalid`,
    username: `wpw_${suffix}`,
    displayName: "Web Push Worker",
    role: "user",
  });
  await sessionRepository.create({
    id: sessionId,
    userId,
    token: `wpw-session-${suffix}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await webPushSubscriptionRepository.upsert({
    id: subscriptionId,
    userId,
    sessionId,
    endpoint: `https://push.example.invalid/${suffix}`,
    p256dh: "worker-key",
    auth: "worker-auth",
    expirationAt: null,
  });
  const created =
    await notificationRepository.createWithPushOutbox({
      id: notificationId,
      recipientId: userId,
      title: "Worker notification",
      message: "Durable worker fixture",
      link: "/notifications",
      type: "system",
      category: "system",
    });
  expect(created.pushJobs).toBe(1);

  const [job] = await db
    .select()
    .from(webPushOutbox)
    .where(
      eq(webPushOutbox.notificationId, notificationId),
    );
  if (!job) throw new Error("Outbox fixture missing");

  return {
    userId,
    sessionId,
    subscriptionId,
    notificationId,
    jobId: job.id,
  };
}

describe("Web Push worker repository", () => {
  it("leases, prepares, retries and later accepts one endpoint job", async () => {
    const f = await fixture("retry");

    expect(
      await webPushWorkerRepository.candidates(100),
    ).toContain(f.jobId);

    const first =
      await webPushWorkerRepository.claim(f.jobId);
    expect(first).toMatchObject({
      id: f.jobId,
      attempt: 1,
    });
    if (!first) throw new Error("First lease missing");

    await expect(
      webPushWorkerRepository.prepare(first),
    ).resolves.toMatchObject({
      id: f.jobId,
      notificationId: f.notificationId,
      subscriptionId: f.subscriptionId,
      endpoint:
        `https://push.example.invalid/retry_${f.userId.split("retry_")[1]}`,
      payload: {
        title: "Worker notification",
        body: "Durable worker fixture",
        url: "/notifications",
        tag: f.notificationId,
      },
      sendWithinMs: expect.any(Number),
    });

    expect(
      await webPushWorkerRepository.settle(
        first,
        "retry",
        503,
      ),
    ).toBe(true);

    const [deferred] = await db
      .select({ availableAt: webPushOutbox.availableAt })
      .from(webPushOutbox)
      .where(eq(webPushOutbox.id, f.jobId));
    expect(deferred?.availableAt.getTime()).toBeGreaterThan(
      Date.now() + 45_000,
    );

    await db
      .update(webPushOutbox)
      .set({
        availableAt: sql`clock_timestamp() - interval '1 second'`,
      })
      .where(eq(webPushOutbox.id, f.jobId));

    const second =
      await webPushWorkerRepository.claim(f.jobId);
    expect(second).toMatchObject({
      id: f.jobId,
      attempt: 2,
    });
    if (!second) throw new Error("Second lease missing");
    expect(second.token).not.toBe(first.token);

    expect(
      await webPushWorkerRepository.settle(
        second,
        "accepted",
        201,
      ),
    ).toBe(true);
    expect(
      await db
        .select()
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, f.jobId)),
    ).toEqual([]);
  });

  it("removes a terminal stale subscription and its queued job together", async () => {
    const f = await fixture("stale");
    const current =
      await webPushWorkerRepository.claim(f.jobId);
    if (!current) throw new Error("Lease missing");

    expect(
      await webPushWorkerRepository.discardStaleSubscription(
        current,
        f.subscriptionId,
      ),
    ).toBe(true);

    expect(
      await webPushSubscriptionRepository.listForSession(
        f.userId,
        f.sessionId,
      ),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, f.jobId)),
    ).toEqual([]);
  });

  it("refuses settlement after lease expiry even before another worker reclaims the job", async () => {
    const f = await fixture("expired_owner");
    const current =
      await webPushWorkerRepository.claim(f.jobId);
    if (!current) throw new Error("Lease missing");

    await db
      .update(webPushOutbox)
      .set({
        leaseExpiresAt:
          sql`clock_timestamp() - interval '1 second'`,
      })
      .where(eq(webPushOutbox.id, f.jobId));

    await expect(
      webPushWorkerRepository.settle(
        current,
        "accepted",
        201,
      ),
    ).resolves.toBe(false);
    await expect(
      webPushWorkerRepository.discardStaleSubscription(
        current,
        f.subscriptionId,
      ),
    ).resolves.toBe(false);
    expect(
      await db
        .select()
        .from(webPushOutbox)
        .where(eq(webPushOutbox.id, f.jobId)),
    ).toHaveLength(1);
  });

  it("refuses settlement from a stale lease owner after reclaim", async () => {
    const f = await fixture("reclaim");
    const first =
      await webPushWorkerRepository.claim(f.jobId);
    if (!first) throw new Error("First lease missing");

    await db
      .update(webPushOutbox)
      .set({
        leaseExpiresAt:
          sql`clock_timestamp() - interval '1 second'`,
      })
      .where(eq(webPushOutbox.id, f.jobId));

    const second =
      await webPushWorkerRepository.claim(f.jobId);
    if (!second) throw new Error("Second lease missing");

    expect(
      await webPushWorkerRepository.settle(
        first,
        "accepted",
        201,
      ),
    ).toBe(false);
    expect(
      await webPushWorkerRepository.settle(
        second,
        "accepted",
        201,
      ),
    ).toBe(true);
  });
});
