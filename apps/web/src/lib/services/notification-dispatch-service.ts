import { notificationRepository } from "@nexus/db";
import type { Notification } from "@nexus/domain";
import { generateId } from "@nexus/security";

const DISPATCH_CONCURRENCY = 10;

export type NotificationDispatchInput = Omit<Notification, "id" | "createdAt" | "isRead"> & {
  id?: string;
};

export type NotificationDispatchSummary = {
  requested: number;
  stored: number;
  storageFailed: number;
  pushQueued: number;
  pushQueueDegraded: number;
};

export async function dispatchNotificationsBestEffort(
  inputs: readonly NotificationDispatchInput[],
): Promise<NotificationDispatchSummary> {
  let stored = 0;
  let storageFailed = 0;
  let pushQueued = 0;
  let pushQueueDegraded = 0;
  for (let offset = 0; offset < inputs.length; offset += DISPATCH_CONCURRENCY) {
    // Keep the number of active transactions bounded by the database pool.
    const batch = inputs.slice(offset, offset + DISPATCH_CONCURRENCY);
    const deliveries = await Promise.allSettled(
      // Convert synchronous preparation/storage failures into settled results.
      batch.map(async (input) =>
        notificationRepository.createWithPushOutbox({
          ...input,
          id: input.id ?? generateId("not"),
        }),
      ),
    );
    // Retain only this batch's results, regardless of the recipient count.
    for (const delivery of deliveries) {
      if (delivery.status === "rejected") {
        storageFailed += 1;
        continue;
      }
      if (delivery.value.notification) stored += 1;
      pushQueued += delivery.value.pushJobs;
      if (
        delivery.value.notification &&
        (delivery.value.pushQueueState === "saturated" || delivery.value.pushQueueState === "error")
      ) {
        pushQueueDegraded += 1;
      }
    }
  }

  if (pushQueueDegraded > 0) {
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        requested: inputs.length,
        stored,
        storageFailed,
        pushQueued,
        pushQueueDegraded,
      }),
    );
  }

  return {
    requested: inputs.length,
    stored,
    storageFailed,
    pushQueued,
    pushQueueDegraded,
  };
}
