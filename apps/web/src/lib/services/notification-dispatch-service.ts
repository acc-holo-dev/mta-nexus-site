import { notificationRepository } from "@nexus/db";
import type { Notification } from "@nexus/domain";
import { generateId } from "@nexus/security";

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
  pushQueued: number;
};

export async function dispatchNotificationsBestEffort(
  inputs: readonly NotificationDispatchInput[],
): Promise<NotificationDispatchSummary> {
  const deliveries = await Promise.allSettled(
    inputs.map((input) =>
      notificationRepository.createWithPushOutbox({
        ...input,
        id: input.id ?? generateId("not"),
      }),
    ),
  );

  let stored = 0;
  let pushQueued = 0;
  for (const delivery of deliveries) {
    if (delivery.status !== "fulfilled") continue;
    if (delivery.value.notification) stored += 1;
    pushQueued += delivery.value.pushJobs;
  }

  return {
    requested: inputs.length,
    stored,
    storageFailed: deliveries.filter(
      (delivery) => delivery.status === "rejected",
    ).length,
    pushQueued,
  };
}
