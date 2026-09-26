import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getSession = vi.hoisted(() => vi.fn());
const isFollowing = vi.hoisted(() => vi.fn());

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession },
}));

vi.mock("@nexus/db", () => ({
  socialRepository: {
    isFollowing,
    follow: vi.fn(),
    unfollow: vi.fn(),
  },
  userRepository: { findById: vi.fn() },
  serverRepository: { findById: vi.fn() },
  productRepository: { findById: vi.fn() },
  organizationRepository: { findById: vi.fn() },
  notificationRepository: { create: vi.fn() },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(),
  generateId: vi.fn(() => "test-id"),
}));

import { GET } from "../apps/web/src/app/api/follow/route";

describe("follow GET cache privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks anonymous follow-state responses private", async () => {
    getSession.mockResolvedValueOnce(null);

    const response = await GET(
      new NextRequest(
        "http://nexus.test/api/follow?targetType=server&targetId=srv_1",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: false,
      following: false,
    });
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("marks authenticated follow-state responses private", async () => {
    getSession.mockResolvedValueOnce({
      id: "usr_follow",
      email: "follow@nexus.test",
      username: "follow",
      displayName: "Follow User",
      role: "user",
    });
    isFollowing.mockResolvedValueOnce(true);

    const response = await GET(
      new NextRequest(
        "http://nexus.test/api/follow?targetType=server&targetId=srv_1",
        { headers: { cookie: "nexus_session=tok_follow" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      following: true,
    });
    expect(isFollowing).toHaveBeenCalledWith(
      "usr_follow",
      "server",
      "srv_1",
    );
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(response.headers.get("Vary")).toBe("Cookie");
  });

  it("keeps validation errors private after authentication", async () => {
    getSession.mockResolvedValueOnce({
      id: "usr_follow",
      role: "user",
    });

    const response = await GET(
      new NextRequest(
        "http://nexus.test/api/follow?targetType=invalid&targetId=x",
        { headers: { cookie: "nexus_session=tok_follow" } },
      ),
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe(
      "private, no-store",
    );
    expect(response.headers.get("Vary")).toBe("Cookie");
  });
});
