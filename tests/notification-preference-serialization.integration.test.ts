import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  notificationRepository,
  userRepository,
} from "@nexus/db";

describe("notification preference serialization", () => {
  it("suppresses preference-controlled inbox creation after a confirmed disable", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_notification_pref_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `notification_pref_${suffix}@example.invalid`,
      username: `notification_pref_${suffix}`,
      displayName: "Notification Preference",
      role: "user",
    });

    await notificationRepository.updatePreferences(userId, {
      systemEnabled: false,
    });

    await expect(
      notificationRepository.createWithPushOutbox({
        id: `not_notification_pref_${suffix}`,
        recipientId: userId,
        title: "System update",
        message: "This notification must respect the committed preference.",
        type: "system",
        category: "system",
      }),
    ).resolves.toEqual({
      notification: null,
      pushJobs: 0,
      pushQueueState: "no_subscriptions",
    });
  });

  it("keeps mandatory security notifications independent from optional preferences", async () => {
    const suffix = randomBytes(6).toString("hex");
    const userId = `usr_notification_security_${suffix}`;

    await userRepository.create({
      id: userId,
      email: `notification_security_${suffix}@example.invalid`,
      username: `notification_security_${suffix}`,
      displayName: "Security Notification",
      role: "user",
    });
    await notificationRepository.updatePreferences(userId, {
      followsEnabled: false,
      contentEnabled: false,
      serverEnabled: false,
      commerceEnabled: false,
      systemEnabled: false,
    });

    const created = await notificationRepository.createWithPushOutbox({
      id: `not_notification_security_${suffix}`,
      recipientId: userId,
      title: "Security notice",
      message: "Mandatory account security information.",
      type: "security",
      category: "security",
    });

    expect(created.notification).toMatchObject({
      recipientId: userId,
      category: "security",
    });
  });
});
