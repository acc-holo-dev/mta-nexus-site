import type { Notification } from "@nexus/domain";
import { deliverConfiguredWebPushNotification } from "./configured-web-push-delivery";

const DEFAULT_NOTIFICATION_PUSH_CONCURRENCY = 8;

export type StoredNotificationPushSummary = {
  notifications: number;
  attempted: number;
  delivered: number;
  failed: number;
  stale: number;
  deliveryErrors: number;
};

export async function deliverStoredNotificationsWebPush(
  notifications: Array<
    Pick<
      Notification,
      "id" | "recipientId" | "title" | "message" | "link"
    >
  >,
  concurrency = DEFAULT_NOTIFICATION_PUSH_CONCURRENCY,
): Promise<StoredNotificationPushSummary> {
  if (
    !Number.isSafeInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 32
  ) {
    throw new RangeError("Invalid notification push concurrency");
  }

  const summary: StoredNotificationPushSummary = {
    notifications: notifications.length,
    attempted: 0,
    delivered: 0,
    failed: 0,
    stale: 0,
    deliveryErrors: 0,
  };

  for (let offset = 0; offset < notifications.length; offset += concurrency) {
    const batch = notifications.slice(offset, offset + concurrency);
    const results = await Promise.all(
      batch.map(async (notification) => {
        try {
          return await deliverConfiguredWebPushNotification(notification);
        } catch {
          return null;
        }
      }),
    );

    for (const result of results) {
      if (!result) {
        summary.deliveryErrors += 1;
        continue;
      }
      if (!result.configured) continue;
      summary.attempted += result.summary.attempted;
      summary.delivered += result.summary.delivered;
      summary.failed += result.summary.failed;
      summary.stale += result.summary.stale;
    }
  }

  return summary;
}
