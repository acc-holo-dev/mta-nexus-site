import { randomBytes } from "node:crypto";
import { and, eq, gt, lt, lte, or, isNull, sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import {
  db,
  notificationRepository,
  sessionRepository,
  userRepository,
  webPushOutbox,
  webPushSubscriptionRepository,
  webPushWorkerRepository,
  WEB_PUSH_MAX_ATTEMPTS,
} from "@nexus/db";
import { WebPushDispatcher } from "../packages/db/src/repositories/web-push-dispatcher";
import type {
  WebPushNotificationPayload,
  WebPushSender,
} from "../packages/db/src/web-push-runtime";

describe("Web Push concurrent worker soak", () => {
  it("delivers every overlapping candidate exactly once across four workers", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_push_soak_${suffix}`;
    const sessionId = `ses_push_soak_${suffix}`;
    const subscriptionId = `wps_push_soak_${suffix}`;
    const jobs = 32;

    await userRepository.create({
      id: userId,
      email: `push_soak_${suffix}@example.invalid`,
      username: `push_soak_${suffix}`,
      displayName: "Push Soak",
      role: "user",
    });
    await sessionRepository.create({
      id: sessionId,
      userId,
      token: `push-soak-${suffix}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    await webPushSubscriptionRepository.upsert({
      id: subscriptionId,
      userId,
      sessionId,
      endpoint: `https://push.example.invalid/soak-${suffix}`,
      p256dh: "soak-key",
      auth: "soak-auth",
      expirationAt: null,
    });

    const notificationIds = [];
    for (let index = 0; index < jobs; index += 1) {
      const notificationId =
        `not_push_soak_${suffix}_${index}`;
      notificationIds.push(notificationId);
      const created =
        await notificationRepository.createWithPushOutbox({
          id: notificationId,
          recipientId: userId,
          title: "Push soak",
          message: `Concurrent job ${index}`,
          link: "/notifications",
          type: "system",
          category: "system",
        });
      expect(created.pushJobs).toBe(1);
    }

    const sentTags: string[] = [];
    const sender = vi.fn(
      async (
        _subscription: Parameters<WebPushSender>[0],
        payload: WebPushNotificationPayload,
      ) => {
        if (!payload.tag) {
          throw new Error("Expected durable notification tag");
        }
        sentTags.push(payload.tag);
        // Yield so candidate/claim overlap is exercised rather than letting one
        // dispatcher synchronously drain every row before peers start.
        await new Promise((resolve) =>
          setTimeout(resolve, 1),
        );
        return { statusCode: 201 };
      },
    );

    // Scope candidates to this fixture subscription so leftover outbox rows
    // from concurrent suites cannot inflate accepted counts.
    const scopedWorker = {
      candidates: async (limit = 20) => {
        const rows = await db
          .select({ id: webPushOutbox.id })
          .from(webPushOutbox)
          .where(
            and(
              eq(webPushOutbox.subscriptionId, subscriptionId),
              lte(webPushOutbox.availableAt, sql`clock_timestamp()`),
              or(
                isNull(webPushOutbox.leaseExpiresAt),
                lte(webPushOutbox.leaseExpiresAt, sql`clock_timestamp()`),
              ),
              gt(webPushOutbox.expiresAt, sql`clock_timestamp()`),
              lt(webPushOutbox.attempts, WEB_PUSH_MAX_ATTEMPTS),
            ),
          )
          .orderBy(webPushOutbox.availableAt, webPushOutbox.id)
          .limit(limit);
        return rows.map((row) => row.id);
      },
      claim: (id: string) => webPushWorkerRepository.claim(id),
      prepare: (lease: Parameters<typeof webPushWorkerRepository.prepare>[0]) =>
        webPushWorkerRepository.prepare(lease),
      settle: (
        ...args: Parameters<typeof webPushWorkerRepository.settle>
      ) => webPushWorkerRepository.settle(...args),
      discardStaleSubscription: (
        ...args: Parameters<
          typeof webPushWorkerRepository.discardStaleSubscription
        >
      ) => webPushWorkerRepository.discardStaleSubscription(...args),
      discardUnavailable: async () => 0,
    };

    const workers = Array.from(
      { length: 4 },
      () => new WebPushDispatcher({ sender, worker: scopedWorker }),
    );
    const summaries = await Promise.all(
      workers.map((dispatcher) =>
        dispatcher.runBatch(100),
      ),
    );

    expect(
      summaries.reduce(
        (total, summary) => total + summary.accepted,
        0,
      ),
    ).toBe(jobs);
    expect(sender).toHaveBeenCalledTimes(jobs);
    expect(sentTags).toHaveLength(jobs);
    expect(new Set(sentTags).size).toBe(jobs);
    expect(new Set(sentTags)).toEqual(
      new Set(notificationIds),
    );

    await expect(
      db
        .select()
        .from(webPushOutbox)
        .where(
          eq(
            webPushOutbox.subscriptionId,
            subscriptionId,
          ),
        ),
    ).resolves.toEqual([]);
  });
});
