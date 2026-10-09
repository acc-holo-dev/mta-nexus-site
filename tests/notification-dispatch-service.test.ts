import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    create.mockReset();
    id = 0;
  });

  afterEach(() => vi.useRealTimers());

  it.each(["rejection", "synchronous throw"])(
    "drains failed batches and continues after a %s",
    async (failure) => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      let active = 0;
      let peak = 0;
      create.mockImplementation((input) => {
        const index = Number(input.recipientId.slice(1));
        if (index === 0 && failure === "synchronous throw") {
          throw new Error("sync storage failure");
        }
        active += 1;
        peak = Math.max(peak, active);
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            active -= 1;
            if (index === 0 || index === 24) {
              reject(new Error("async storage failure"));
              return;
            }
            resolve({
              notification: index === 11 ? null : { id: input.id },
              pushJobs: index === 12 ? 2 : 0,
              pushQueueState: index === 20 ? "saturated" : index === 21 ? "error" : "queued",
            });
          }, 1);
        });
      });
      const inputs = Array.from({ length: 25 }, (_, index) => ({
        recipientId: `u${index}`,
        title: "Private title",
        message: "Private message",
        type: "system" as const,
        category: "system" as const,
      }));
      // Attach both handlers before advancing timers, including on regression.
      const result = dispatchNotificationsBestEffort(inputs).then(
        (value) => ({ value, error: null }),
        (error: unknown) => ({ value: null, error }),
      );
      try {
        await vi.advanceTimersByTimeAsync(0);
        expect(create).toHaveBeenCalledTimes(10);
        await vi.advanceTimersByTimeAsync(1);
        expect(create).toHaveBeenCalledTimes(20);
        await vi.runAllTimersAsync();
        const summary = {
          requested: 25,
          stored: 22,
          storageFailed: 2,
          pushQueued: 2,
          pushQueueDegraded: 2,
        };
        await expect(result).resolves.toEqual({ value: summary, error: null });
        expect(create).toHaveBeenCalledTimes(25);
        expect(active).toBe(0);
        expect(peak).toBeLessThanOrEqual(10);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(JSON.parse(String(warn.mock.calls[0]?.[0]))).toEqual({
          event: "notification.push_outbox_degraded",
          ...summary,
        });
      } finally {
        await vi.runAllTimersAsync();
        await result;
        warn.mockRestore();
      }
    },
  );

  it("returns an empty summary without starting database deliveries", async () => {
    await expect(dispatchNotificationsBestEffort([])).resolves.toEqual({
      requested: 0,
      stored: 0,
      storageFailed: 0,
      pushQueued: 0,
      pushQueueDegraded: 0,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("bounds active database deliveries and drains each batch before continuing", async () => {
    vi.useFakeTimers();
    let active = 0;
    let peak = 0;
    create.mockImplementation(async (input) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active -= 1;
      return {
        notification: { id: input.id, recipientId: input.recipientId },
        pushJobs: 0,
        pushQueueState: "no_subscriptions" as const,
      };
    });

    const inputs = Array.from({ length: 25 }, (_, index) => ({
      recipientId: `u${index}`,
      title: `Title ${index}`,
      message: "Message",
      type: "system" as const,
      category: "system" as const,
    }));
    const dispatch = dispatchNotificationsBestEffort(inputs);
    await vi.advanceTimersByTimeAsync(0);
    expect(create).toHaveBeenCalledTimes(10);
    expect(peak).toBe(10);
    await vi.runAllTimersAsync();

    await expect(dispatch).resolves.toMatchObject({ requested: 25, stored: 25 });
    expect(create).toHaveBeenCalledTimes(25);
    expect(active).toBe(0);
    expect(peak).toBe(10);
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
    const sensitive = {
      recipientId: "u1",
      title: "Sensitive title",
      message: "Sensitive message",
      type: "system" as const,
      category: "system" as const,
      link: "/private/sensitive-link",
    };
    create.mockResolvedValueOnce({
      notification: { id: "not_1", recipientId: "u1" },
      pushJobs: 0,
      pushQueueState: "saturated",
    });

    await expect(dispatchNotificationsBestEffort([sensitive])).resolves.toMatchObject({
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
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ id: "ntf_deterministic" }));
  });
});
