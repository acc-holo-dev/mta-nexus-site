import { AppError } from "@nexus/domain";
import { expect, it, vi } from "vitest";

vi.mock("next/server", async (original) => {
  const { discoveryFollowHttpState } = await import("./helpers/discovery-follow-http-harness");
  return {
    ...(await original<typeof import("next/server")>()),
    after: (fn: () => Promise<unknown>) => discoveryFollowHttpState.callbacks.push(fn),
  };
});
vi.mock("@nexus/db", async () => {
  const { discoveryFollowHttpMocks } = await import("./helpers/discovery-follow-http-harness");
  return {
    followWorkspaceRepository: {
      setFollowingAuthenticated: discoveryFollowHttpMocks.setFollowing,
      states: discoveryFollowHttpMocks.states,
      contentStates: discoveryFollowHttpMocks.contentStates,
      muteState: discoveryFollowHttpMocks.muteState,
    },
    socialRepository: { isFollowing: discoveryFollowHttpMocks.isFollowing },
  };
});
vi.mock("@nexus/security", async () => {
  const { discoveryFollowHttpMocks } = await import("./helpers/discovery-follow-http-harness");
  return { consumeRateLimit: discoveryFollowHttpMocks.rate, generateId: () => "generated" };
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { discoveryFollowHttpState } = await import("./helpers/discovery-follow-http-harness");
  return { authService: { getSession: async () => discoveryFollowHttpState.actor } };
});
vi.mock("../apps/web/src/lib/services/discovery-service", async () => {
  const { discoveryFollowHttpMocks } = await import("./helpers/discovery-follow-http-harness");
  return { discoveryService: { page: discoveryFollowHttpMocks.discover } };
});
vi.mock("../apps/web/src/lib/services/follow-workspace-service", async () => {
  const { discoveryFollowHttpMocks } = await import("./helpers/discovery-follow-http-harness");
  return { followWorkspaceService: { page: discoveryFollowHttpMocks.follows } };
});
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", async () => {
  const { discoveryFollowHttpMocks } = await import("./helpers/discovery-follow-http-harness");
  return { dispatchNotificationsBestEffort: discoveryFollowHttpMocks.notifications };
});

import { DELETE, GET as followState, POST } from "../apps/web/src/app/api/follow/route";
import {
  discoveryFollowHttpMocks as mocks,
  discoveryFollowHttpRequest as request,
  discoveryFollowHttpState as state,
  installDiscoveryFollowHttpLifecycle,
} from "./helpers/discovery-follow-http-harness";

installDiscoveryFollowHttpLifecycle();

it("returns exact target identity and marks a user's own profile", async () => {
  const response = await followState(request("/api/follow?targetType=user&targetId=actor"));
  expect(await response.json()).toMatchObject({
    targetType: "user",
    targetId: "actor",
    authenticated: true,
    self: true,
  });
});
it.each([POST, DELETE])(
  "authenticates, rate-limits and validates both desired-state commands",
  async (handler) => {
    state.actor = null;
    expect(
      (await handler(request("/api/follow", "POST", { targetType: "server", targetId: "target" })))
        .status,
    ).toBe(401);
    state.actor = { id: "actor", username: "member" };
    mocks.rate.mockResolvedValue({ success: false });
    expect(
      (await handler(request("/api/follow", "POST", { targetType: "server", targetId: "target" })))
        .status,
    ).toBe(429);
    mocks.rate.mockResolvedValue({ success: true });
    for (const body of [
      null,
      [],
      { targetType: "server", targetId: "x", followerId: "other" },
      { targetType: "admin", targetId: "x" },
      { targetType: "user", targetId: "x".repeat(129) },
    ])
      expect((await handler(request("/api/follow", "POST", body))).status).toBe(400);
    expect(mocks.setFollowing).not.toHaveBeenCalled();
  },
);
it.each([POST, DELETE])(
  "rejects cross-site, form-encoded and oversized writes",
  async (handler) => {
    const body = { targetType: "server", targetId: "target" };
    expect(
      (
        await handler(
          request("/api/follow", "POST", body, "ru", { "sec-fetch-site": "cross-site" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (await handler(request("/api/follow", "POST", body, "en", { "content-type": "text/plain" })))
        .status,
    ).toBe(415);
    expect(
      (await handler(request("/api/follow", "POST", { ...body, extra: "x".repeat(33000) }))).status,
    ).toBe(413);
    expect(mocks.setFollowing).not.toHaveBeenCalled();
  },
);
it("confirms repeated follows without duplicating the follower notification", async () => {
  mocks.setFollowing.mockResolvedValue({ following: true, created: false });
  const response = await POST(
    request("/api/follow", "POST", { targetType: "user", targetId: "target" }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    success: true,
    following: true,
    targetType: "user",
    targetId: "target",
  });
  expect(state.callbacks).toHaveLength(0);
});
it("keeps a committed follow confirmed without after() notification dispatch", async () => {
  mocks.notifications.mockRejectedValue(new Error("delivery failed"));
  const response = await POST(
    request("/api/follow", "POST", { targetType: "user", targetId: "target" }),
  );
  expect(await response.json()).toMatchObject({ success: true, following: true });
  expect(mocks.notifications).not.toHaveBeenCalled();
  expect(state.callbacks).toHaveLength(0);
});
it("allows removing an unavailable target and translates fresh availability denials", async () => {
  const body = { targetType: "server", targetId: "missing" };
  const removed = await DELETE(request("/api/follow", "DELETE", body));
  expect(await removed.json()).toMatchObject({ success: true, following: false, ...body });
  expect(mocks.setFollowing).toHaveBeenCalledWith(
    "actor",
    "server",
    "missing",
    false,
    "generated",
    {},
    "test",
  );
  mocks.setFollowing.mockRejectedValue(new AppError("Target does not exist", 404, "NOT_FOUND"));
  const denied = await POST(request("/api/follow", "POST", body, "ru"));
  expect(denied.status).toBe(404);
  expect((await denied.json()).error).toMatch(/недоступен/u);
});
it("reads only the authenticated reader's discussion subscription state", async () => {
  const response = await followState(
    request("/api/follow?targetType=content&targetId=publication&actorId=foreign"),
  );
  expect(await response.json()).toMatchObject({
    authenticated: true,
    following: true,
    notifyComments: true,
    targetType: "content",
    targetId: "publication",
  });
  expect(mocks.contentStates).toHaveBeenCalledExactlyOnceWith("actor", ["publication"]);
  expect(mocks.isFollowing).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
});
it.each([POST, DELETE])(
  "persists a desired discussion subscription without creating a profile-follower notice",
  async (handler) => {
    const response = await handler(
      request("/api/follow", handler === POST ? "POST" : "DELETE", {
        targetType: "content",
        targetId: "publication",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      following: handler === POST,
      targetType: "content",
      targetId: "publication",
      notifyComments: handler === POST,
    });
    expect(mocks.setFollowing).toHaveBeenCalledExactlyOnceWith(
      "actor",
      "content",
      "publication",
      handler === POST,
      "generated",
      handler === POST ? { notifyComments: undefined } : {},
      "test",
    );
    expect(state.callbacks).toHaveLength(0);
  },
);
it("never reads content follow state for an anonymous request", async () => {
  state.actor = null;
  expect(
    await (
      await followState(request("/api/follow?targetType=content&targetId=publication"))
    ).json(),
  ).toMatchObject({ authenticated: false, following: false });
  expect(mocks.states).not.toHaveBeenCalled();
});

it.each([POST, DELETE])(
  "rejects a follow command for the previously displayed account after cookie switch",
  async (handler) => {
    const response = await handler(
      request("/api/follow", handler === POST ? "POST" : "DELETE", {
        targetType: "server",
        targetId: "target",
        expectedActorId: "previous_actor",
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
    expect(mocks.setFollowing).not.toHaveBeenCalled();
  },
);
