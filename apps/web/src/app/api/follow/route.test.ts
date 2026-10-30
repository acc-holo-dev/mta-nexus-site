import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_1", username: "tester" } as { id: string; username: string } | null,
  follow: { id: "fol_1", followerId: "usr_1", targetType: "user", targetId: "usr_2" } as Record<
    string,
    string
  > | null,
  following: true,
}));

const markSingle = vi.hoisted(() => vi.fn(async () => false));
const markAll = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("../../../lib/services/auth-service", () => ({
  authService: { getSession: vi.fn(async () => state.user) },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_new`),
}));
vi.mock("@nexus/db", async () => ({
  followWorkspaceRepository: {
    setFollowing: vi.fn(async (_actor: string, _type: string, _id: string, following: boolean) => {
      if (following && !state.follow && !state.following) {
        const { AppError } = await import("@nexus/domain");
        throw new AppError("Unconfirmed", 503, "UNCONFIRMED");
      }
      return { following, created: following && !!state.follow };
    }),
  },
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
    listByUser: vi.fn(async () =>
      Array.from({ length: 100 }, (_, index) => ({ id: `not_${index}`, isRead: true })),
    ),
    countUnread: vi.fn(async () => 137),
    markAsRead: markSingle,
    markAllAsRead: markAll,
  },
}));

import { DELETE as unfollow, GET as followState, POST as follow } from "./route";
import { POST as markRead } from "../notifications/mark-read/route";
import { GET as listNotifications } from "../notifications/route";

function expectPrivate(response: Response) {
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
}

const makeRequest = (path: string, method: string, body?: string) =>
  new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: {
      ...((path.startsWith("/api/follow") && method !== "GET") ||
      path.startsWith("/api/notifications/")
        ? browserMutationHeaders()
        : {}),
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body }),
  });

describe("social and notification HTTP state contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    state.user = { id: "usr_1", username: "tester" };
    state.follow = { id: "fol_1", followerId: "usr_1", targetType: "user", targetId: "usr_2" };
    state.following = true;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps anonymous and authenticated follow-state reads private", async () => {
    state.user = null;
    const anonymous = await followState(
      makeRequest("/api/follow?targetType=server&targetId=srv_1", "GET"),
    );
    expect(anonymous.status).toBe(200);
    expectPrivate(anonymous);
    expect(await anonymous.json()).toEqual({
      authenticated: false,
      following: false,
      targetType: "server",
      targetId: "srv_1",
    });

    state.user = { id: "usr_1", username: "tester" };
    state.following = true;
    const authenticated = await followState(
      makeRequest("/api/follow?targetType=user&targetId=usr_2", "GET"),
    );
    expect(authenticated.status).toBe(200);
    expectPrivate(authenticated);
    expect(await authenticated.json()).toEqual({
      authenticated: true,
      following: true,
      targetType: "user",
      targetId: "usr_2",
    });
  });

  it("keeps follow-state validation errors private", async () => {
    const response = await followState(
      makeRequest("/api/follow?targetType=invalid&targetId=x", "GET"),
    );
    expect(response.status).toBe(400);
    expectPrivate(response);
  });

  it("confirms a committed follow without Next.js after() notification dispatch", async () => {
    const response = await follow(
      makeRequest("/api/follow", "POST", '{"targetType":"user","targetId":"usr_2"}'),
    );
    expect(response.status).toBe(200);
    expectPrivate(response);
    expect(await response.json()).toMatchObject({
      success: true,
      targetType: "user",
      targetId: "usr_2",
      following: true,
    });
  });

  it("checks the exact follow key before confirming a conflict", async () => {
    state.follow = null;
    state.following = false;
    const response = await follow(
      makeRequest("/api/follow", "POST", '{"targetType":"user","targetId":"usr_2"}'),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ code: "UNCONFIRMED" });
  });

  it("returns canonical unfollow state and rejects unbounded IDs", async () => {
    const response = await unfollow(
      makeRequest("/api/follow", "DELETE", '{"targetType":"user","targetId":"usr_2"}'),
    );
    expect(await response.json()).toMatchObject({
      success: true,
      following: false,
      targetId: "usr_2",
    });
    const invalid = await follow(
      makeRequest(
        "/api/follow",
        "POST",
        JSON.stringify({ targetType: "user", targetId: "x".repeat(129) }),
      ),
    );
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
    const forbidden = await markRead(
      makeRequest("/api/notifications/mark-read", "POST", '{"id":"not_other"}'),
    );
    expect(forbidden.status).toBe(404);
    expect(markAll).not.toHaveBeenCalled();

    const bulk = await markRead(makeRequest("/api/notifications/mark-read", "POST"));
    expect(bulk.status).toBe(200);
    expectPrivate(bulk);
    expect(await bulk.json()).toEqual({ success: true, scope: "all" });
    expect(markAll).toHaveBeenCalledWith("usr_1");
  });
});
