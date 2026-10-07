import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  config: {
    publicKey: "pub-a",
    privateKey: "priv-a",
    subject: "mailto:first@nexus.example.com",
  } as {
    publicKey: string;
    privateKey: string;
    subject: string;
  } | null,
}));

const createSender = vi.hoisted(() =>
  vi.fn(() => vi.fn(async () => ({ statusCode: 201 }))),
);
const deliver = vi.hoisted(() =>
  vi.fn(async () => ({
    attempted: 0,
    delivered: 0,
    failed: 0,
    stale: 0,
    removedStale: 0,
  })),
);

vi.mock("@nexus/config", () => ({
  readWebPushVapidConfig: vi.fn(() => state.config),
}));

vi.mock("@nexus/db", () => ({
  webPushSubscriptionRepository: {},
}));

vi.mock(
  "../apps/web/src/lib/services/web-push-http-sender",
  () => ({
    createWebPushHttpSender: createSender,
  }),
);

vi.mock(
  "../apps/web/src/lib/services/web-push-delivery-service",
  () => ({
    deliverWebPushToUser: deliver,
  }),
);

import { deliverConfiguredWebPushNotification } from "../apps/web/src/lib/services/configured-web-push-delivery";

const notification = {
  id: "not_1",
  recipientId: "usr_1",
  title: "NEXUS",
  message: "Update",
  link: "/notifications",
};

describe("configured Web Push sender cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses an identical config but rebuilds on subject rotation or disable/re-enable", async () => {
    await deliverConfiguredWebPushNotification(notification);
    await deliverConfiguredWebPushNotification(notification);
    expect(createSender).toHaveBeenCalledTimes(1);

    state.config = {
      publicKey: "pub-a",
      privateKey: "priv-a",
      subject: "mailto:second@nexus.example.com",
    };
    await deliverConfiguredWebPushNotification(notification);
    expect(createSender).toHaveBeenCalledTimes(2);

    state.config = null;
    await expect(
      deliverConfiguredWebPushNotification(notification),
    ).resolves.toMatchObject({
      configured: false,
      summary: { attempted: 0 },
    });

    state.config = {
      publicKey: "pub-a",
      privateKey: "priv-a",
      subject: "mailto:second@nexus.example.com",
    };
    await deliverConfiguredWebPushNotification(notification);
    expect(createSender).toHaveBeenCalledTimes(3);
  });
});
