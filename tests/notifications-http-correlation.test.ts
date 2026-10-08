import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: { id: "usr_notifications" } as { id: string } | null,
  sessionId: "ses_notifications" as string | null,
  allowed: true,
  fail: false,
}));

const notificationRepository = vi.hoisted(() => ({
  listByUser: vi.fn(async () => {
    if (state.fail) throw new Error("db unavailable");
    return [];
  }),
  countUnread: vi.fn(async () => 0),
  markAsRead: vi.fn(async () => true),
  markAllAsRead: vi.fn(async () => undefined),
  getPreferences: vi.fn(async () => ({
    follow: true,
    content: true,
    security: true,
    system: true,
  })),
  updatePreferences: vi.fn(async (_userId, value) => value),
}));

const pushRepository = vi.hoisted(() => ({
  listForSession: vi.fn(async () => []),
  upsertWithResult: vi.fn(async () => ({
    status: "stored",
    subscription: {},
  })),
  removeForSession: vi.fn(async () => true),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
    getCurrentSessionId: vi.fn(async () => state.sessionId),
  },
}));

vi.mock("@nexus/db", () => ({
  notificationRepository,
  webPushSubscriptionRepository: pushRepository,
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: state.allowed,
  })),
  generateId: vi.fn(() => "wps_test"),
}));

vi.mock("@nexus/config", () => ({
  readWebPushVapidConfig: vi.fn(() => ({
    publicKey: "public-key",
    privateKey: "private-key",
    subject: "mailto:ops@nexus.test",
  })),
}));

vi.mock("../apps/web/src/lib/web-push-subscription", () => ({
  parseWebPushSubscription: vi.fn(() => ({
    endpoint: "https://push.example.test/subscription",
    p256dh: "p256dh",
    auth: "auth",
    expirationAt: null,
  })),
}));

import { GET as inboxGET } from "../apps/web/src/app/api/notifications/route";
import { POST as markReadPOST } from "../apps/web/src/app/api/notifications/mark-read/route";
import {
  GET as preferencesGET,
  PATCH as preferencesPATCH,
} from "../apps/web/src/app/api/notifications/preferences/route";
import {
  DELETE as pushDELETE,
  GET as pushGET,
  POST as pushPOST,
} from "../apps/web/src/app/api/notifications/push/route";

function request(
  path: string,
  method = "GET",
  body?: unknown,
) {
  return new NextRequest(
    `https://nexus.test${path}`,
    {
      method,
      headers: {
        cookie:
          "nexus_session=notification-token",
        ...(body === undefined
          ? {}
          : {
              "content-type":
                "application/json",
            }),
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) }),
    },
  );
}

function expectPrivateCorrelation(
  response: Response,
) {
  expect(
    response.headers.get("cache-control"),
  ).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe(
    "Cookie",
  );
  expect(
    response.headers.get("x-request-id"),
  ).toMatch(/^[0-9a-f-]{20,}$/u);
}

describe("notification API request correlation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "usr_notifications" };
    state.sessionId = "ses_notifications";
    state.allowed = true;
    state.fail = false;
  });

  it("correlates inbox and anonymous inbox reads", async () => {
    const authenticated = await inboxGET(
      request("/api/notifications?limit=6"),
    );
    expect(authenticated.status).toBe(200);
    expectPrivateCorrelation(authenticated);

    state.user = null;
    const anonymous = await inboxGET(
      request("/api/notifications"),
    );
    expect(anonymous.status).toBe(200);
    expectPrivateCorrelation(anonymous);
    await expect(
      anonymous.json(),
    ).resolves.toEqual({
      notifications: [],
      unreadCount: 0,
    });
  });

  it("correlates notification mutation validation and success", async () => {
    const invalid = await markReadPOST(
      request(
        "/api/notifications/mark-read",
        "POST",
        { unknown: true },
      ),
    );
    expect(invalid.status).toBe(400);
    expectPrivateCorrelation(invalid);

    const success = await markReadPOST(
      request(
        "/api/notifications/mark-read",
        "POST",
        {},
      ),
    );
    expect(success.status).toBe(200);
    expectPrivateCorrelation(success);
  });

  it("correlates preference reads, validation failures and updates", async () => {
    const read = await preferencesGET(
      request(
        "/api/notifications/preferences",
      ),
    );
    expect(read.status).toBe(200);
    expectPrivateCorrelation(read);

    const invalid = await preferencesPATCH(
      request(
        "/api/notifications/preferences",
        "PATCH",
        { follow: "yes" },
      ),
    );
    expect(invalid.status).toBe(400);
    expectPrivateCorrelation(invalid);

    const updated = await preferencesPATCH(
      request(
        "/api/notifications/preferences",
        "PATCH",
        {
          follow: true,
          content: true,
          security: true,
          system: true,
        },
      ),
    );
    expect(updated.status).toBe(200);
    expectPrivateCorrelation(updated);
  });

  it("correlates Web Push state, registration and removal", async () => {
    const read = await pushGET(
      request("/api/notifications/push"),
    );
    expect(read.status).toBe(200);
    expectPrivateCorrelation(read);

    const registered = await pushPOST(
      request(
        "/api/notifications/push",
        "POST",
        { endpoint: "fixture" },
      ),
    );
    expect(registered.status).toBe(200);
    expectPrivateCorrelation(registered);

    const removed = await pushDELETE(
      request(
        "/api/notifications/push",
        "DELETE",
        {
          endpoint:
            "https://push.example.test/subscription",
        },
      ),
    );
    expect(removed.status).toBe(200);
    expectPrivateCorrelation(removed);
  });

  it("returns correlated private failures without exposing raw errors", async () => {
    state.fail = true;
    const log = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    try {
      const response = await inboxGET(
        request("/api/notifications"),
      );
      expect(response.status).toBe(500);
      expectPrivateCorrelation(response);
      expect(
        JSON.stringify(await response.json()),
      ).not.toContain("db unavailable");
    } finally {
      log.mockRestore();
    }
  });
});
