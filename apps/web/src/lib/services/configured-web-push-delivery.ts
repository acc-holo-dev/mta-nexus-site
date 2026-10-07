import { readWebPushVapidConfig } from "@nexus/config";
import {
  webPushSubscriptionRepository,
} from "@nexus/db";
import type { Notification } from "@nexus/domain";
import {
  deliverWebPushToUser,
  type WebPushDeliverySummary,
  type WebPushSender,
} from "./web-push-delivery-service";
import { createWebPushHttpSender } from "./web-push-http-sender";

export type ConfiguredWebPushDeliveryResult = {
  configured: boolean;
  summary: WebPushDeliverySummary;
};

const EMPTY_SUMMARY: WebPushDeliverySummary = {
  attempted: 0,
  delivered: 0,
  failed: 0,
  stale: 0,
  removedStale: 0,
};

let cachedVapidIdentity: string | null = null;
let cachedSender: WebPushSender | null = null;

function configuredSender(): WebPushSender | null {
  const config = readWebPushVapidConfig();
  if (!config) {
    cachedVapidIdentity = null;
    cachedSender = null;
    return null;
  }

  const vapidIdentity = `${config.publicKey}\n${config.subject}`;
  if (!cachedSender || cachedVapidIdentity !== vapidIdentity) {
    cachedSender = createWebPushHttpSender(config, {
      timeoutMs: 5_000,
      ttlSeconds: 300,
    });
    cachedVapidIdentity = vapidIdentity;
  }
  return cachedSender;
}

export async function deliverConfiguredWebPushNotification(
  notification: Pick<
    Notification,
    "id" | "recipientId" | "title" | "message" | "link"
  >,
): Promise<ConfiguredWebPushDeliveryResult> {
  const sender = configuredSender();
  if (!sender) {
    return {
      configured: false,
      summary: { ...EMPTY_SUMMARY },
    };
  }

  return {
    configured: true,
    summary: await deliverWebPushToUser(
      notification.recipientId,
      {
        title: notification.title,
        body: notification.message,
        ...(notification.link ? { url: notification.link } : {}),
        tag: notification.id,
      },
      sender,
      webPushSubscriptionRepository,
    ),
  };
}
