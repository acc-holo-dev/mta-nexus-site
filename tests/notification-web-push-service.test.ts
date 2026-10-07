import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  active: 0,
  maxActive: 0,
}));

const deliverConfigured = vi.hoisted(() =>
  vi.fn(async (notification: { id: string }) => {
    if (notification.id === "error") {
      throw new Error("push delivery failed");
    }
    if (notification.id === "disabled") {
      return {
        configured: false,
        summary: {
          attempted: 0,
          delivered: 0,
          failed: 0,
          stale: 0,
          removedStale: 0,
        },
      };
    }
    if (notification.id === "mixed") {
      return {
        configured: true,
        summary: {
          attempted: 2,
          delivered: 0,
          failed: 1,
          stale: 1,
          removedStale: 1,
        },
      };
    }

    state.active += 1;
    state.maxActive = Math.max(state.maxActive, state.active);
    try {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      return {
        configured: true,
        summary: {
          attempted: 1,
          delivered: 1,
          failed: 0,
          stale: 0,
          removedStale: 0,
        },
      };
    } finally {
      state.active -= 1;
    }
  }),
);

vi.mock(
  "../apps/web/src/lib/services/configured-web-push-delivery",
  () => ({
    deliverConfiguredWebPushNotification: deliverConfigured,
  }),
);

import { deliverStoredNotificationsWebPush } from "../apps/web/src/lib/services/notification-web-push-service";

function notification(id: string) {
  return {
    id,
    recipientId: `usr_${id}`,
    title: "MTA NEXUS",
    message: `Notification ${id}`,
    link: "/notifications",
  };
}

describe("stored notification Web Push batching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.active = 0;
    state.maxActive = 0;
  });

  it("enforces the requested concurrency bound", async () => {
    const notifications = Array.from(
      { length: 7 },
      (_, index) => notification(`n${index}`),
    );

    await expect(
      deliverStoredNotificationsWebPush(notifications, 3),
    ).resolves.toEqual({
      notifications: 7,
      attempted: 7,
      delivered: 7,
      failed: 0,
      stale: 0,
      deliveryErrors: 0,
    });

    expect(deliverConfigured).toHaveBeenCalledTimes(7);
    expect(state.maxActive).toBe(3);
    expect(state.active).toBe(0);
  });

  it("keeps disabled delivery, provider failures and thrown errors distinct", async () => {
    await expect(
      deliverStoredNotificationsWebPush(
        [
          notification("disabled"),
          notification("mixed"),
          notification("error"),
        ],
        2,
      ),
    ).resolves.toEqual({
      notifications: 3,
      attempted: 2,
      delivered: 0,
      failed: 1,
      stale: 1,
      deliveryErrors: 1,
    });
  });

  it.each([0, 33, 1.5, Number.NaN])(
    "rejects invalid concurrency %s",
    async (concurrency) => {
      await expect(
        deliverStoredNotificationsWebPush([], concurrency),
      ).rejects.toThrow("Invalid notification push concurrency");
    },
  );
});
