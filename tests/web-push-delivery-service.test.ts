import { describe, expect, it, vi } from "vitest";
import type { WebPushSubscriptionRecord } from "@nexus/db";
import {
  deliverWebPushToUser,
  normalizeWebPushPayload,
} from "../apps/web/src/lib/services/web-push-delivery-service";

function subscription(
  id: string,
  endpoint = `https://push.example.invalid/${id}`,
): WebPushSubscriptionRecord {
  return {
    id,
    userId: "usr_push_delivery",
    sessionId: `ses_${id}`,
    endpoint,
    p256dh: `p256dh-${id}`,
    auth: `auth-${id}`,
    expirationAt: null,
    userAgent: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

function store(records: WebPushSubscriptionRecord[]) {
  return {
    listByUser: vi.fn(async (_userId: string) => records),
    removeForSession: vi.fn(
      async (
        _userId: string,
        _sessionId: string,
        _endpoint: string,
      ) => true,
    ),
  };
}

describe("Web Push delivery coordinator", () => {
  it("normalizes payloads to the same bounded surface as the service worker", () => {
    expect(
      normalizeWebPushPayload({
        title: " ".repeat(2),
        body: "",
        url: " /security ",
        tag: "x".repeat(200),
      }),
    ).toEqual({
      title: "MTA NEXUS",
      body: "You have a new notification.",
      url: "/security",
      tag: "x".repeat(120),
    });
  });

  it("drops external and protocol-relative notification targets", () => {
    for (const url of [
      "https://evil.example/account",
      "//evil.example/account",
      "javascript:alert(1)",
      "settings",
    ]) {
      expect(
        normalizeWebPushPayload({
          title: "NEXUS",
          body: "Update",
          url,
        }),
      ).toEqual({
        title: "NEXUS",
        body: "Update",
      });
    }

    expect(
      normalizeWebPushPayload({
        title: "NEXUS",
        body: "Update",
        url: "/security?tab=sessions#active",
      }),
    ).toMatchObject({
      url: "/security?tab=sessions#active",
    });
  });

  it("delivers active subscriptions and removes terminal stale endpoints", async () => {
    const records = [
      subscription("ok"),
      subscription("gone"),
      subscription("failed"),
    ];
    const repository = store(records);
    const sender = vi.fn(async (record: { endpoint: string }) => {
      if (record.endpoint.endsWith("/ok")) return { statusCode: 201 };
      if (record.endpoint.endsWith("/gone")) return { statusCode: 410 };
      return { statusCode: 503 };
    });

    await expect(
      deliverWebPushToUser(
        "usr_push_delivery",
        {
          title: "Security notice",
          body: "Review your session.",
          url: "/security",
        },
        sender,
        repository,
      ),
    ).resolves.toEqual({
      attempted: 3,
      delivered: 1,
      failed: 1,
      stale: 1,
      removedStale: 1,
    });

    expect(sender).toHaveBeenCalledTimes(3);
    expect(repository.removeForSession).toHaveBeenCalledWith(
      "usr_push_delivery",
      "ses_gone",
      "https://push.example.invalid/gone",
    );
  });

  it("counts sender exceptions as delivery failures without deleting the endpoint", async () => {
    const repository = store([subscription("network-error")]);

    await expect(
      deliverWebPushToUser(
        "usr_push_delivery",
        { title: "NEXUS", body: "Update" },
        async () => {
          throw new Error("network unavailable");
        },
        repository,
      ),
    ).resolves.toEqual({
      attempted: 1,
      delivered: 0,
      failed: 1,
      stale: 0,
      removedStale: 0,
    });

    expect(repository.removeForSession).not.toHaveBeenCalled();
  });

  it("does no sender work when the repository has no active subscriptions", async () => {
    const repository = store([]);
    const sender = vi.fn(async () => ({ statusCode: 201 }));

    await expect(
      deliverWebPushToUser(
        "usr_push_delivery",
        { title: "NEXUS", body: "Update" },
        sender,
        repository,
      ),
    ).resolves.toEqual({
      attempted: 0,
      delivered: 0,
      failed: 0,
      stale: 0,
      removedStale: 0,
    });
    expect(sender).not.toHaveBeenCalled();
  });
});
