import { notificationRepository } from "@nexus/db";
import type { Notification } from "@nexus/domain";
import { generateId } from "@nexus/security";
import { deliverStoredNotificationsWebPush } from "./notification-web-push-service";

export type NotificationDispatchInput = Omit<
  Notification,
  "id" | "createdAt" | "isRead"
> & {
  id?: string;
};

export type NotificationDispatchSummary = {
  requested: number;
  stored: number;
  storageFailed: number;
  push: Awaited<ReturnType<typeof deliverStoredNotificationsWebPush>>;
};

export async function dispatchNotificationsBestEffort(
  inputs: readonly NotificationDispatchInput[],
): Promise<NotificationDispatchSummary> {
  const deliveries = await Promise.allSettled(
    inputs.map((input) =>
      notificationRepository.create({
        ...input,
        id: input.id ?? generateId("not"),
      }),
    ),
  );

  const stored = deliveries.flatMap((delivery) =>
    delivery.status === "fulfilled" && delivery.value
      ? [delivery.value]
      : [],
  );

  return {
    requested: inputs.length,
    stored: stored.length,
    storageFailed: deliveries.filter(
      (delivery) => delivery.status === "rejected",
    ).length,
    push: await deliverStoredNotificationsWebPush(stored),
  };
}
