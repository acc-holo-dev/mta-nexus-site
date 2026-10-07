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
