import { NextRequest } from "next/server";
import { UnauthorizedError } from "@nexus/domain";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../tests/helpers/browser-mutation-headers";

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
    followsEnabled: true,
    contentEnabled: true,
    serverEnabled: true,
    systemEnabled: true,
  })),
  updatePreferences: vi.fn(async (_userId, value) => value),
}));

const pushRepository = vi.hoisted(() => ({
  listForSession: vi.fn(async () => []),
  upsertAuthenticated: vi.fn(async () => ({
    status: "stored",
    subscription: {},
  })),
  removeAuthenticated: vi.fn(async () => true),
}));

vi.mock("../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
    getSessionIdentity: vi.fn(async () =>
      state.user && state.sessionId ? { user: state.user, sessionId: state.sessionId } : null,
    ),
    getCurrentSessionId: vi.fn(async () => state.sessionId),
  },
}));

vi.mock("@nexus/db", async () => {
  // Keep the pure endpoint validator real without importing the database client.
  const { parseWebPushEndpoint } = await import("../../../../packages/db/src/web-push-runtime");
  return {
    notificationRepository,
    webPushSubscriptionRepository: pushRepository,
    parseWebPushEndpoint,
  };
});

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

vi.mock("../../../lib/web-push-subscription", () => ({
  parseWebPushSubscription: vi.fn(() => ({
    endpoint: "https://push.example.net/subscription",
    p256dh: "p256dh",
    auth: "auth",
    expirationAt: null,
  })),
}));

import { authService } from "../../../lib/services/auth-service";
import { POST as markReadPOST } from "./mark-read/route";
import { GET as preferencesGET, PATCH as preferencesPATCH } from "./preferences/route";
import { DELETE as pushDELETE, GET as pushGET, POST as pushPOST } from "./push/route";
import { GET as inboxGET } from "./route";

function request(path: string, method = "GET", body?: unknown) {
  return new NextRequest(`https://nexus.test${path}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : browserMutationHeaders()),
      cookie: "nexus_session=notification-token",
      ...(body === undefined
        ? {}
        : {
            "content-type": "application/json",
          }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

function expectPrivateCorrelation(response: Response) {
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toMatch(/^[0-9a-f-]{20,}$/u);
}

describe("notification API request correlation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    state.user = { id: "usr_notifications" };
    state.sessionId = "ses_notifications";
    state.allowed = true;
    state.fail = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("correlates inbox and anonymous inbox reads", async () => {
    const authenticated = await inboxGET(request("/api/notifications?limit=6"));
    expect(authenticated.status).toBe(200);
    expectPrivateCorrelation(authenticated);

    state.user = null;
    const anonymous = await inboxGET(request("/api/notifications"));
    expect(anonymous.status).toBe(200);
    expectPrivateCorrelation(anonymous);
    await expect(anonymous.json()).resolves.toEqual({
      actorId: null,
      notifications: [],
      unreadCount: 0,
    });
  });

  it("correlates notification mutation validation and success", async () => {
    const invalid = await markReadPOST(
      request("/api/notifications/mark-read", "POST", { unknown: true }),
    );
    expect(invalid.status).toBe(400);
    expectPrivateCorrelation(invalid);

    const success = await markReadPOST(
      request("/api/notifications/mark-read", "POST", { expectedActorId: "usr_notifications" }),
    );
    expect(success.status).toBe(200);
    expectPrivateCorrelation(success);
  });

  it("correlates preference reads, validation failures and updates", async () => {
    const read = await preferencesGET(request("/api/notifications/preferences"));
    expect(read.status).toBe(200);
    expectPrivateCorrelation(read);
    expect(await read.json()).toMatchObject({ actorId: "usr_notifications" });

    const invalid = await preferencesPATCH(
      request("/api/notifications/preferences", "PATCH", { follow: "yes" }),
    );
    expect(invalid.status).toBe(400);
    expectPrivateCorrelation(invalid);

    const updated = await preferencesPATCH(
      request("/api/notifications/preferences", "PATCH", {
        expectedActorId: "usr_notifications",
        followsEnabled: true,
        contentEnabled: true,
        serverEnabled: true,
        systemEnabled: true,
      }),
    );
    expect(updated.status).toBe(200);
    expectPrivateCorrelation(updated);
    expect(await updated.json()).toMatchObject({ actorId: "usr_notifications" });
    expect(notificationRepository.updatePreferences).toHaveBeenCalledWith(
      "usr_notifications",
      {
        followsEnabled: true,
        contentEnabled: true,
        serverEnabled: true,
        systemEnabled: true,
      },
      "notification-token",
    );
  });

  it("rejects stale or absent preference account identity without updating another account", async () => {
    for (const payload of [
      { expectedActorId: "usr_previous", followsEnabled: false },
      { followsEnabled: false },
    ]) {
      const response = await preferencesPATCH(
        request("/api/notifications/preferences", "PATCH", payload),
      );
      expect(response.status).toBe("expectedActorId" in payload ? 409 : 400);
      expectPrivateCorrelation(response);
    }
    expect(notificationRepository.updatePreferences).not.toHaveBeenCalled();
  });

  it("returns a private 401 when the initiating session is no longer valid", async () => {
    notificationRepository.updatePreferences.mockRejectedValueOnce(
      new UnauthorizedError("Authentication required"),
    );
    const response = await preferencesPATCH(
      request("/api/notifications/preferences", "PATCH", {
        expectedActorId: "usr_notifications",
        followsEnabled: false,
        contentEnabled: true,
        serverEnabled: true,
        systemEnabled: true,
      }),
    );
    expect(response.status).toBe(401);
    expectPrivateCorrelation(response);
    expect(await response.json()).toMatchObject({
      error: "Authentication required",
      code: "UNAUTHORIZED",
    });
  });

  it("rejects non-JSON and oversized preference updates without saving", async () => {
    const wrongMedia = await preferencesPATCH(
      new NextRequest("https://nexus.test/api/notifications/preferences", {
        method: "PATCH",
        headers: {
          ...browserMutationHeaders(),
          "content-type": "text/plain",
          cookie: "nexus_session=notification-token",
        },
        body: JSON.stringify({ followsEnabled: true }),
      }),
    );
    expect(wrongMedia.status).toBe(415);
    expectPrivateCorrelation(wrongMedia);
    expect(await wrongMedia.json()).toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    const oversized = await preferencesPATCH(
      request("/api/notifications/preferences", "PATCH", { extra: "x".repeat(4096) }),
    );
    expect(oversized.status).toBe(413);
    expectPrivateCorrelation(oversized);
    expect(await oversized.json()).toMatchObject({ code: "REQUEST_BODY_TOO_LARGE" });
    expect(notificationRepository.updatePreferences).not.toHaveBeenCalled();
  });

  it("correlates Web Push state, registration and removal", async () => {
    const read = await pushGET(request("/api/notifications/push"));
    expect(read.status).toBe(200);
    expectPrivateCorrelation(read);

    const registered = await pushPOST(
      request("/api/notifications/push", "POST", {
        endpoint: "fixture",
        expectedActorId: "usr_notifications",
        expectedSessionId: "ses_notifications",
      }),
    );
    expect(registered.status).toBe(200);
    expectPrivateCorrelation(registered);

    const removed = await pushDELETE(
      request("/api/notifications/push", "DELETE", {
        endpoint: "https://push.example.net/subscription",
        expectedActorId: "usr_notifications",
        expectedSessionId: "ses_notifications",
      }),
    );
    expect(removed.status).toBe(200);
    expectPrivateCorrelation(removed);
    expect(authService.getSessionIdentity).toHaveBeenCalledTimes(3);
    expect(authService.getSession).not.toHaveBeenCalled();
    expect(authService.getCurrentSessionId).not.toHaveBeenCalled();
  });

  it.each([
    ["GET", pushGET],
    ["POST", pushPOST],
    ["DELETE", pushDELETE],
  ] as const)("refuses Web Push %s without a valid session identity", async (method, handler) => {
    state.sessionId = null;
    const response = await handler(request("/api/notifications/push", method));
    expect(response.status).toBe(401);
    expectPrivateCorrelation(response);
    expect(authService.getSessionIdentity).toHaveBeenCalledOnce();
    expect(pushRepository.listForSession).not.toHaveBeenCalled();
    expect(pushRepository.upsertAuthenticated).not.toHaveBeenCalled();
    expect(pushRepository.removeAuthenticated).not.toHaveBeenCalled();
  });

  it("returns correlated private failures without exposing raw errors", async () => {
    state.fail = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await inboxGET(request("/api/notifications"));
      expect(response.status).toBe(500);
      expectPrivateCorrelation(response);
      expect(JSON.stringify(await response.json())).not.toContain("db unavailable");
    } finally {
      log.mockRestore();
    }
  });
});
