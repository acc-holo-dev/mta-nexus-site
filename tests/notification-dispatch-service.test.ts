import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
let id = 0;

vi.mock("@nexus/db", () => ({
  notificationRepository: { create },
}));
vi.mock("@nexus/security", () => ({
  generateId: vi.fn(() => `not_generated_${++id}`),
}));
vi.mock("../apps/web/src/lib/services/notification-web-push-service", () => ({
  deliverStoredNotificationsWebPush: push,
}));

import { dispatchNotificationsBestEffort } from "../apps/web/src/lib/services/notification-dispatch-service";

describe("notification dispatch service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    id = 0;
    push.mockResolvedValue({
      notifications: 0,
      attempted: 0,
      delivered: 0,
      failed: 0,
      stale: 0,
      deliveryErrors: 0,
    });
  });

  it("pushes only notifications that survived preferences/storage", async () => {
    create
      .mockResolvedValueOnce({ id: "not_1", recipientId: "u1" })
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error("db unavailable"));
    push.mockResolvedValueOnce({
      notifications: 1,
      attempted: 1,
      delivered: 1,
      failed: 0,
      stale: 0,
      deliveryErrors: 0,
    });

    await expect(
      dispatchNotificationsBestEffort([
        {
          recipientId: "u1",
          title: "One",
          message: "Stored",
          type: "system",
          category: "system",
        },
        {
          recipientId: "u2",
          title: "Two",
          message: "Suppressed",
          type: "system",
          category: "system",
        },
        {
          recipientId: "u3",
          title: "Three",
          message: "Failed",
          type: "system",
          category: "system",
        },
      ]),
    ).resolves.toEqual({
      requested: 3,
      stored: 1,
      storageFailed: 1,
      push: {
        notifications: 1,
        attempted: 1,
        delivered: 1,
        failed: 0,
        stale: 0,
        deliveryErrors: 0,
      },
    });
    expect(push).toHaveBeenCalledWith([
      expect.objectContaining({ id: "not_1" }),
    ]);
  });

  it("preserves explicit deterministic notification IDs", async () => {
    create.mockImplementation(async (value) => value);
    await dispatchNotificationsBestEffort([
      {
        id: "ntf_deterministic",
        recipientId: "u1",
        title: "Stable",
        message: "Stable",
        type: "security",
        category: "security",
      },
    ]);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ntf_deterministic" }),
    );
  });
});
