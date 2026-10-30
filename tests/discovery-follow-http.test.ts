import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  actor: { id: "actor", username: "member" } as { id: string; username: string } | null,
  callbacks: [] as (() => Promise<unknown>)[],
}));
const mocks = vi.hoisted(() => ({
  discover: vi.fn(),
  follows: vi.fn(),
  setFollowing: vi.fn(),
  isFollowing: vi.fn(),
  states: vi.fn(),
  rate: vi.fn(),
  notifications: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: (fn: () => Promise<unknown>) => state.callbacks.push(fn),
}));
vi.mock("@nexus/db", () => ({
  followWorkspaceRepository: { setFollowing: mocks.setFollowing, states: mocks.states },
  socialRepository: { isFollowing: mocks.isFollowing },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate, generateId: () => "generated" }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { page: mocks.discover },
}));
vi.mock("../apps/web/src/lib/services/follow-workspace-service", () => ({
  followWorkspaceService: { page: mocks.follows },
}));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.notifications,
}));

import { GET as discover } from "../apps/web/src/app/api/discover/route";
import { DELETE, GET as followState, POST } from "../apps/web/src/app/api/follow/route";
import { GET as follows } from "../apps/web/src/app/api/workspace/follows/route";

function request(path: string, method = "GET", body?: unknown, locale = "en", headers = {}) {
  return new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test;nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.actor = { id: "actor", username: "member" };
  state.callbacks = [];
  mocks.rate.mockResolvedValue({ success: true });
  mocks.discover.mockResolvedValue({ type: "servers", items: [], page: 2, hasMore: false });
  mocks.follows.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.isFollowing.mockResolvedValue(true);
  mocks.states.mockResolvedValue(["publication"]);
  mocks.setFollowing.mockImplementation(async (_actor, _type, _id, value) => ({
    following: value,
    created: value,
  }));
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("serves anonymous paginated Discovery using category-specific normalized filters", async () => {
  state.actor = null;
  const response = await discover(
    request("/api/discover?type=servers&page=2&q=RP&language=ru&verified=1&sort=name"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("public");
  expect(mocks.discover).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "servers",
      query: "RP",
      page: 2,
      language: "ru",
      verified: true,
      sort: "name",
    }),
  );
});
it.each([
  "page=0",
  "page=1001",
  "page=2&page=3",
  "type=unknown",
  "verified=true",
  "sort=players",
  `q=${"x".repeat(101)}`,
  "contentType=private",
])("rejects invalid Discovery query %s before reading data", async (query) => {
  const response = await discover(request(`/api/discover?${query}`));
  expect(response.status).toBe(400);
  expect(mocks.discover).not.toHaveBeenCalled();
  expect(response.headers.get("cache-control")).toBe("no-store");
});
it("rate limits Discovery and localizes redacted errors in Russian", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  const rate = await discover(request("/api/discover", "GET", undefined, "ru"));
  expect(rate.status).toBe(429);
  expect((await rate.json()).error).toMatch(/Слишком/u);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.discover.mockRejectedValue(new Error("postgres-secret"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const response = await discover(request("/api/discover", "GET", undefined, "ru"));
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("postgres-secret");
  } finally {
    log.mockRestore();
  }
});
it("never reads another user's saved list and keeps every response private", async () => {
  state.actor = null;
  const anonymous = await follows(request("/api/workspace/follows"));
  expect(anonymous.status).toBe(401);
  expect(mocks.follows).not.toHaveBeenCalled();
  state.actor = { id: "actor", username: "member" };
  const response = await follows(request("/api/workspace/follows?type=user&q=Team&userId=other"));
  expect(mocks.follows).toHaveBeenCalledWith("actor", {
    type: "user",
    query: "Team",
    cursor: undefined,
  });
  for (const value of [anonymous, response]) {
    expect(value.headers.get("cache-control")).toBe("private, no-store");
    expect(value.headers.get("vary")).toBe("Cookie");
  }
});
it.each([
  "type=invalid",
  "type=user&type=server",
  "cursor=broken",
  "cursor=x&cursor=y",
  `q=${"x".repeat(101)}`,
])("rejects malformed private follow filters %s", async (query) => {
  const response = await follows(request(`/api/workspace/follows?${query}`));
  expect(response.status).toBe(400);
  expect(mocks.follows).not.toHaveBeenCalled();
});
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
  expect(mocks.setFollowing).toHaveBeenCalledWith("actor", "server", "missing", false, "generated");
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
    targetType: "content",
    targetId: "publication",
  });
  expect(mocks.states).toHaveBeenCalledExactlyOnceWith("actor", "content", ["publication"]);
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
    });
    expect(mocks.setFollowing).toHaveBeenCalledExactlyOnceWith(
      "actor",
      "content",
      "publication",
      handler === POST,
      "generated",
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
it("paginates saved discussions within the authenticated reader's own workspace", async () => {
  const response = await follows(request("/api/workspace/follows?type=content&q=Lua"));
  expect(response.status).toBe(200);
  expect(mocks.follows).toHaveBeenCalledExactlyOnceWith("actor", {
    type: "content",
    query: "Lua",
    cursor: undefined,
  });
});
