import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
  getSessionIdentity: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "wps_a",
}));
vi.mock("@nexus/db", () => ({
  notificationRepository: {
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    updatePreferences: vi.fn(),
    getPreferences: vi.fn(),
  },
  webPushSubscriptionRepository: {
    upsertWithResult: vi.fn(),
    removeForSession: vi.fn(),
    listForSession: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/notification-inbox-service", () => ({
  notificationInboxService: {
    page: vi.fn(),
    command: vi.fn(),
  },
}));
vi.mock("@nexus/config", () => ({
  readWebPushVapidConfig: () => null,
}));

import { PATCH as inboxCommand } from "../apps/web/src/app/api/notifications/inbox/route";
import { POST as markRead } from "../apps/web/src/app/api/notifications/mark-read/route";
import { PATCH as preferences } from "../apps/web/src/app/api/notifications/preferences/route";
import {
  DELETE as pushDelete,
  POST as pushSubscribe,
} from "../apps/web/src/app/api/notifications/push/route";

const mutations = [
  ["inbox command", "PATCH", inboxCommand, "getSession"],
  ["mark read", "POST", markRead, "getSession"],
  ["preferences", "PATCH", preferences, "getSession"],
  ["push subscribe", "POST", pushSubscribe, "getSessionIdentity"],
  ["push unsubscribe", "DELETE", pushDelete, "getSessionIdentity"],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/notifications/inbox", {
    method,
    headers: {
      cookie: "nexus_session=member",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ isRead: true, items: [{ id: "owned", expectedIsRead: false }] }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
  authService.getSessionIdentity.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("notification handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler, session) => {
      const input = request(method);
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService[session]).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler, session) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService[session]).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler, session) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
      );
      expect(authService[session]).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
