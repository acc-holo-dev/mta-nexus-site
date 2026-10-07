import type { WebPushSubscriptionRecord } from "@nexus/db";

export type WebPushNotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

export type WebPushSendResult = {
  statusCode: number;
};

export type WebPushSender = (
  subscription: Pick<
    WebPushSubscriptionRecord,
    "endpoint" | "p256dh" | "auth"
  >,
  payload: WebPushNotificationPayload,
) => Promise<WebPushSendResult>;

export type WebPushSubscriptionStore = {
  listByUser(userId: string): Promise<WebPushSubscriptionRecord[]>;
  removeForSession(
    userId: string,
    sessionId: string,
    endpoint: string,
  ): Promise<boolean>;
};

export type WebPushDeliverySummary = {
  attempted: number;
  delivered: number;
  failed: number;
  stale: number;
  removedStale: number;
};

function boundedText(
  value: unknown,
  maxLength: number,
): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : undefined;
}

export function normalizeWebPushPayload(
  value: WebPushNotificationPayload,
): WebPushNotificationPayload {
  const url = boundedText(value.url, 2048);
  const tag = boundedText(value.tag, 120);
  return {
    title: boundedText(value.title, 120) ?? "MTA NEXUS",
    body:
      boundedText(value.body, 280) ??
      "You have a new notification.",
    ...(url ? { url } : {}),
    ...(tag ? { tag } : {}),
  };
}

export async function deliverWebPushToUser(
  userId: string,
  payload: WebPushNotificationPayload,
  sender: WebPushSender,
  store: WebPushSubscriptionStore,
): Promise<WebPushDeliverySummary> {
  const subscriptions = await store.listByUser(userId);
  const normalizedPayload = normalizeWebPushPayload(payload);
  const summary: WebPushDeliverySummary = {
    attempted: subscriptions.length,
    delivered: 0,
    failed: 0,
    stale: 0,
    removedStale: 0,
  };

  for (const subscription of subscriptions) {
    try {
      const result = await sender(subscription, normalizedPayload);
      if (result.statusCode >= 200 && result.statusCode < 300) {
        summary.delivered += 1;
        continue;
      }

      if (result.statusCode === 404 || result.statusCode === 410) {
        summary.stale += 1;
        if (
          await store.removeForSession(
            subscription.userId,
            subscription.sessionId,
            subscription.endpoint,
          )
        ) {
          summary.removedStale += 1;
        }
        continue;
      }

      summary.failed += 1;
    } catch {
      summary.failed += 1;
    }
  }

  return summary;
}
