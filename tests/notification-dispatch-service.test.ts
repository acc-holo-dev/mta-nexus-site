import { beforeEach, describe, expect, it, vi } from "vitest";

const create = vi.hoisted(() => vi.fn());
let id = 0;

vi.mock("@nexus/db", () => ({
  notificationRepository: { createWithPushOutbox: create },
}));
vi.mock("@nexus/security", () => ({
  generateId: vi.fn(() => `not_generated_${++id}`),
}));

import { dispatchNotificationsBestEffort } from "../apps/web/src/lib/services/notification-dispatch-service";

describe("notification dispatch service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    id = 0;
  });

  it("stores notifications and reports durable push jobs without network delivery", async () => {
    create
      .mockResolvedValueOnce({
        notification: { id: "not_1", recipientId: "u1" },
        pushJobs: 2,
        pushQueueState: "queued",
      })
      .mockResolvedValueOnce({
        notification: null,
        pushJobs: 0,
        pushQueueState: "no_subscriptions",
      })
      .mockRejectedValueOnce(new Error("db unavailable"));

    const sensitive = {
      recipientId: "u1",
      title: "Sensitive title",
      message: "Sensitive message",
      type: "system" as const,
      category: "system" as const,
      link: "/private/sensitive-link",
    };

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
      pushQueued: 2,
      pushQueueDegraded: 0,
    });
  });

  it("reports a stored inbox row whose push queue degraded without logging notification content", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    create.mockResolvedValueOnce({
      notification: { id: "not_1", recipientId: "u1" },
      pushJobs: 0,
      pushQueueState: "saturated",
    });

    await expect(
      dispatchNotificationsBestEffort([
        sensitive,
      ]),
    ).resolves.toMatchObject({
      stored: 1,
      pushQueued: 0,
      pushQueueDegraded: 1,
    });

    expect(warn).toHaveBeenCalledTimes(1);
    const logged = warn.mock.calls[0]?.[0];
    expect(typeof logged).toBe("string");
    const parsed = JSON.parse(String(logged));
    expect(parsed).toEqual({
      event: "notification.push_outbox_degraded",
      requested: 1,
      stored: 1,
      storageFailed: 0,
      pushQueued: 0,
      pushQueueDegraded: 1,
    });
    expect(String(logged)).not.toContain(sensitive.recipientId);
    expect(String(logged)).not.toContain(sensitive.title);
    expect(String(logged)).not.toContain(sensitive.message);
    expect(String(logged)).not.toContain(sensitive.link);
    warn.mockRestore();
  });

  it("preserves explicit deterministic notification IDs", async () => {
    create.mockImplementation(async (value) => ({
      notification: value,
      pushJobs: 0,
      pushQueueState: "no_subscriptions",
    }));
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
