import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  user: { id: "usr_1", username: "tester" } as { id: string; username: string } | null,
  follow: { id: "fol_1", followerId: "usr_1", targetType: "user", targetId: "usr_2" } as Record<string, string> | null,
  following: true,
  notificationFails: false,
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const dispatchNotifications = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.notificationFails) {
      throw new Error("delivery unavailable");
    }
    return {
      requested: 1,
      stored: 1,
      storageFailed: 0,
      push: {
        notifications: 1,
        attempted: 0,
        delivered: 0,
        failed: 0,
        stale: 0,
        deliveryErrors: 0,
      },
    };
  }),
);
const markSingle = vi.hoisted(() => vi.fn(async () => false));
const markAll = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => state.user) },
}));
vi.mock("../../../lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: dispatchNotifications,
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_new`),
}));
vi.mock("@nexus/db", () => ({
  userRepository: { findById: vi.fn(async () => ({ id: "usr_2" })) },
  serverRepository: { findById: vi.fn(async () => null) },
  productRepository: { findById: vi.fn(async () => null) },
  organizationRepository: { findById: vi.fn(async () => null) },
  socialRepository: {
    isFollowing: vi.fn(async () => state.following),
    follow: vi.fn(async () => state.follow),
    unfollow: vi.fn(async () => undefined),
  },
  notificationRepository: {
    listByUser: vi.fn(async () => Array.from({ length: 100 }, (_, index) => ({ id: `not_${index}`, isRead: true }))),
    countUnread: vi.fn(async () => 137),
    markAsRead: markSingle,
    markAllAsRead: markAll,
  },
}));

import { POST as follow, DELETE as unfollow } from "./route";
import { POST as markRead } from "../notifications/mark-read/route";
import { GET as listNotifications } from "../notifications/route";

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

const makeRequest = (path: string, method: string, body?: string) =>
  new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: { "content-type": "application/json" },
    ...(body === undefined ? {} : { body }),
  });

describe("social and notification HTTP state contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    state.user = { id: "usr_1", username: "tester" };
    state.follow = { id: "fol_1", followerId: "usr_1", targetType: "user", targetId: "usr_2" };
    state.following = true;
    state.notificationFails = false;
  });

  it("confirms a committed follow before best-effort notification delivery", async () => {
    state.notificationFails = true;
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await follow(
        makeRequest(
          "/api/follow",
          "POST",
          '{"targetType":"user","targetId":"usr_2"}',
        ),
      );
      expect(response.status).toBe(200);
      expectPrivate(response);
      expect(await response.json()).toMatchObject({
        success: true,
        targetType: "user",
        targetId: "usr_2",
        following: true,
      });
      expect(afterMock).toHaveBeenCalledOnce();
      expect(dispatchNotifications).not.toHaveBeenCalled();

      await state.afterCallbacks[0]?.();

      expect(dispatchNotifications).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledOnce();
    } finally {
      log.mockRestore();
    }
  });

  it("pushes only the successfully stored follower notification after response", async () => {
    const response = await follow(
      makeRequest(
        "/api/follow",
        "POST",
        '{"targetType":"user","targetId":"usr_2"}',
      ),
    );

    expect(response.status).toBe(200);
    expect(dispatchNotifications).not.toHaveBeenCalled();

    await state.afterCallbacks[0]?.();

    expect(dispatchNotifications).toHaveBeenCalledWith([
      expect.objectContaining({
        recipientId: "usr_2",
        category: "follow",
      }),
    ]);
  });

  it("checks the exact follow key before confirming a conflict", async () => {
    state.follow = null;
    state.following = false;
    const response = await follow(makeRequest("/api/follow", "POST", '{"targetType":"user","targetId":"usr_2"}'));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ following: false, targetId: "usr_2" });
  });

  it("returns canonical unfollow state and rejects unbounded IDs", async () => {
    const response = await unfollow(makeRequest("/api/follow", "DELETE", '{"targetType":"user","targetId":"usr_2"}'));
    expect(await response.json()).toMatchObject({ success: true, following: false, targetId: "usr_2" });
    const invalid = await follow(makeRequest("/api/follow", "POST", JSON.stringify({ targetType: "user", targetId: "x".repeat(129) })));
    expect(invalid.status).toBe(400);
  });

  it("rejects malformed notification bodies before any bulk mutation", async () => {
    for (const body of ["not-json", "null", '{"id":null}', '{"unexpected":true}']) {
      const response = await markRead(makeRequest("/api/notifications/mark-read", "POST", body));
      expect(response.status).toBe(400);
      expectPrivate(response);
    }
    expect(markAll).not.toHaveBeenCalled();
    expect(markSingle).not.toHaveBeenCalled();
  });

  it("reports the global unread total beyond the 100-item inbox window", async () => {
    const response = await listNotifications(makeRequest("/api/notifications?limit=100", "GET"));
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(data.notifications).toHaveLength(100);
    expect(data.unreadCount).toBe(137);
  });

  it("keeps single ownership errors separate from confirmed bulk operations", async () => {
    const forbidden = await markRead(makeRequest("/api/notifications/mark-read", "POST", '{"id":"not_other"}'));
    expect(forbidden.status).toBe(404);
    expect(markAll).not.toHaveBeenCalled();

    const bulk = await markRead(makeRequest("/api/notifications/mark-read", "POST"));
    expect(bulk.status).toBe(200);
    expectPrivate(bulk);
    expect(await bulk.json()).toEqual({ success: true, scope: "all" });
    expect(markAll).toHaveBeenCalledWith("usr_1");
  });
});
