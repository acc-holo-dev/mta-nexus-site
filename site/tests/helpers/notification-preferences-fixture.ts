import { randomUUID } from "node:crypto";
import { notificationRepository, sessionRepository } from "@nexus/db";
import type { NotificationPreferences } from "@nexus/domain";

/** Exercise the authenticated write path without retaining a fixture session. */
export async function setNotificationPreferencesForTest(
  userId: string,
  changes: Partial<
    Pick<
      NotificationPreferences,
      "followsEnabled" | "contentEnabled" | "serverEnabled" | "commerceEnabled" | "systemEnabled"
    >
  >,
) {
  const key = randomUUID(),
    token = `fixture_notification_${key}`;
  await sessionRepository.create({
    id: `ses_fixture_${key}`,
    userId,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  try {
    return await notificationRepository.updatePreferences(userId, changes, token);
  } finally {
    await sessionRepository.delete(token);
  }
}
