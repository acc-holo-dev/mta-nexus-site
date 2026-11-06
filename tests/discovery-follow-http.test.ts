import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
import { browserMutationHeaders } from "./browser-mutation-headers";

vi.mock("next/server", async (original) => {
  const { createDiscoveryFollowHttpNextServerMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpNextServerMock(original);
});
vi.mock("@nexus/db", async () => {
  const { createDiscoveryFollowHttpDbMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpDbMock();
});
vi.mock("@nexus/security", async () => {
  const { createDiscoveryFollowHttpSecurityMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpSecurityMock();
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createDiscoveryFollowHttpAuthMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpAuthMock();
});
vi.mock("../apps/web/src/lib/services/discovery-service", async () => {
  const { createDiscoveryFollowHttpDiscoveryMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpDiscoveryMock();
});
vi.mock("../apps/web/src/lib/services/follow-workspace-service", async () => {
  const { createDiscoveryFollowHttpFollowWorkspaceMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpFollowWorkspaceMock();
});
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", async () => {
  const { createDiscoveryFollowHttpNotificationsMock } = await import(
    "./helpers/discovery-follow-http-harness"
  );
  return createDiscoveryFollowHttpNotificationsMock();
});

import { GET as discover } from "../apps/web/src/app/api/discover/route";
import { GET as follows } from "../apps/web/src/app/api/workspace/follows/route";
import {
  discoveryFollowHttpMocks as mocks,
  discoveryFollowHttpState as state,
  installDiscoveryFollowHttpHooks,
} from "./helpers/discovery-follow-http-harness";

function request(path: string, method = "GET", body?: unknown, locale = "en", headers = {}) {
  return new NextRequest(`http://nexus.test${path}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test;nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined
      ? {}
      : {
          body: JSON.stringify(
            path === "/api/follow" && body && typeof body === "object" && !Array.isArray(body)
              ? { expectedActorId: "actor", ...body }
              : body,
          ),
        }),
  });
}

installDiscoveryFollowHttpHooks();

it("serves anonymous paginated Discovery using category-specific normalized filters", async () => {
  state.actor = null;
  const response = await discover(
    request("/api/discover?type=servers&page=2&q=RP&language=ru&verified=1&sort=name"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
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
it("paginates saved discussions within the authenticated reader's own workspace", async () => {
  const response = await follows(request("/api/workspace/follows?type=content&q=Lua"));
  expect(response.status).toBe(200);
  expect(mocks.follows).toHaveBeenCalledExactlyOnceWith("actor", {
    type: "content",
    query: "Lua",
    cursor: undefined,
  });
});
