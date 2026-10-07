import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  sessionRepository,
  userRepository,
  webPushSubscriptionRepository,
} from "@nexus/db";

describe("Web Push active subscription repository", () => {
  it("excludes expired subscriptions and subscriptions bound to expired sessions", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_push_active_${suffix}`;
    const activeSessionId = `ses_push_active_${suffix}`;
    const expiredSessionId = `ses_push_expired_${suffix}`;
    const now = Date.now();

    await userRepository.create({
      id: userId,
      email: `push_${suffix}@example.invalid`,
      username: `push_${suffix}`,
      displayName: "Push Integration",
      role: "user",
    });

    await sessionRepository.create({
      id: activeSessionId,
      userId,
      token: `active-token-${suffix}`,
      expiresAt: new Date(now + 60 * 60 * 1000),
    });
    await sessionRepository.create({
      id: expiredSessionId,
      userId,
      token: `expired-token-${suffix}`,
      expiresAt: new Date(now - 60 * 1000),
    });

    const insert = async (
      id: string,
      sessionId: string,
      endpointSuffix: string,
      expirationAt: Date | null,
    ) =>
      webPushSubscriptionRepository.upsert({
        id,
        userId,
        sessionId,
        endpoint: `https://push.example.invalid/${endpointSuffix}`,
        p256dh: "test-p256dh",
        auth: "test-auth",
        expirationAt,
      });

    await insert(
      `wps_active_${suffix}`,
      activeSessionId,
      `active-${suffix}`,
      null,
    );
    await insert(
      `wps_future_${suffix}`,
      activeSessionId,
      `future-${suffix}`,
      new Date(now + 30 * 60 * 1000),
    );
    await insert(
      `wps_expired_${suffix}`,
      activeSessionId,
      `expired-${suffix}`,
      new Date(now - 30 * 60 * 1000),
    );
    await insert(
      `wps_expired_session_${suffix}`,
      expiredSessionId,
      `expired-session-${suffix}`,
      null,
    );

    expect(
      await webPushSubscriptionRepository.countForSession(
        userId,
        activeSessionId,
      ),
    ).toBe(2);
    expect(
      await webPushSubscriptionRepository.countForSession(
        userId,
        expiredSessionId,
      ),
    ).toBe(0);

    const active = await webPushSubscriptionRepository.listByUser(userId);
    expect(active.map((item) => item.id).sort()).toEqual(
      [`wps_active_${suffix}`, `wps_future_${suffix}`].sort(),
    );
  });
});


it("never rebinds an existing push endpoint to another session", async () => {
  const suffix = randomBytes(6).toString("hex");
  const firstUserId = `usr_push_owner_${suffix}`;
  const secondUserId = `usr_push_other_${suffix}`;
  const firstSessionId = `ses_push_owner_${suffix}`;
  const secondSessionId = `ses_push_other_${suffix}`;
  const endpoint = `https://push.example.invalid/shared-${suffix}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  for (const [userId, username] of [
    [firstUserId, `push_owner_${suffix}`],
    [secondUserId, `push_other_${suffix}`],
  ] as const) {
    await userRepository.create({
      id: userId,
      email: `${username}@example.invalid`,
      username,
      displayName: username,
      role: "user",
    });
  }

  await sessionRepository.create({
    id: firstSessionId,
    userId: firstUserId,
    token: `owner-token-${suffix}`,
    expiresAt,
  });
  await sessionRepository.create({
    id: secondSessionId,
    userId: secondUserId,
    token: `other-token-${suffix}`,
    expiresAt,
  });

  const created = await webPushSubscriptionRepository.upsert({
    id: `wps_owner_${suffix}`,
    userId: firstUserId,
    sessionId: firstSessionId,
    endpoint,
    p256dh: "first-key",
    auth: "first-auth",
    expirationAt: null,
  });
  expect(created).not.toBeNull();

  const refreshed = await webPushSubscriptionRepository.upsert({
    id: `wps_ignored_${suffix}`,
    userId: firstUserId,
    sessionId: firstSessionId,
    endpoint,
    p256dh: "refreshed-key",
    auth: "refreshed-auth",
    expirationAt: null,
  });
  expect(refreshed).toMatchObject({
    userId: firstUserId,
    sessionId: firstSessionId,
    p256dh: "refreshed-key",
  });

  await expect(
    webPushSubscriptionRepository.upsert({
      id: `wps_other_${suffix}`,
      userId: secondUserId,
      sessionId: secondSessionId,
      endpoint,
      p256dh: "other-key",
      auth: "other-auth",
      expirationAt: null,
    }),
  ).resolves.toBeNull();

  expect(
    await webPushSubscriptionRepository.listByUser(firstUserId),
  ).toEqual([
    expect.objectContaining({
      endpoint,
      userId: firstUserId,
      sessionId: firstSessionId,
      p256dh: "refreshed-key",
    }),
  ]);
  expect(
    await webPushSubscriptionRepository.listByUser(secondUserId),
  ).toEqual([]);
});
