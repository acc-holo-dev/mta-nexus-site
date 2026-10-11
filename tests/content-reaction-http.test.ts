import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  state: vi.fn(),
  set: vi.fn(),
  page: vi.fn(),
  remove: vi.fn(),
  trust: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/content-reaction-service", () => ({
  contentReactionService: {
    state: mocks.state,
    set: mocks.set,
    page: mocks.page,
    remove: mocks.remove,
  },
}));
vi.mock("../apps/web/src/lib/services/public-user-trust-service", () => ({
  publicUserTrustService: { get: mocks.trust },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "trusted-ip",
}));
import { GET as state, PUT } from "../apps/web/src/app/api/content/[slug]/reactions/route";
import { GET as page } from "../apps/web/src/app/api/workspace/reactions/route";
import { DELETE } from "../apps/web/src/app/api/workspace/reactions/[id]/route";
import { GET as trust } from "../apps/web/src/app/api/users/[username]/trust/route";
const actor = { id: "actor", role: "user" },
  publication = { params: Promise.resolve({ slug: "guide" }) },
  cleanup = { params: Promise.resolve({ id: "content" }) },
  profile = { params: Promise.resolve({ username: "writer" }) };
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api${query}`, {
    method,
    headers: {
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.state.mockResolvedValue({ reaction: "thanks" });
  mocks.set.mockResolvedValue({ reaction: "helpful" });
  mocks.page.mockResolvedValue({ items: [] });
  mocks.remove.mockResolvedValue({ contentId: "content", removed: true });
  mocks.trust.mockResolvedValue({ identity: { verified: true } });
});
it("reads personalized counts privately with no-store headers and trusted-IP limits", async () => {
  const response = await state(request(), publication);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("x-request-id")).toBeTruthy();
  expect(mocks.state).toHaveBeenCalledWith("guide", "actor");
  expect(mocks.rate).toHaveBeenCalledWith("search", "trusted-ip");
  mocks.session.mockResolvedValue(null);
  await state(request(), publication);
  expect(mocks.state).toHaveBeenLastCalledWith("guide", undefined);
});
it.each(["helpful", "thanks", "insight", null])(
  "persists an explicit desired reaction %s through the server service",
  async (reaction) => {
    expect((await PUT(request("PUT", { reaction }), publication)).status).toBe(200);
    expect(mocks.set).toHaveBeenCalledWith(actor, "guide", reaction);
    expect(mocks.rate).toHaveBeenCalledWith("contentReaction", "actor");
  },
);
it("requires session, same-site request, JSON and bounded actual bytes for mutation", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await PUT(request("PUT", { reaction: "helpful" }), publication)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  expect(
    (
      await PUT(
        request("PUT", { reaction: "helpful" }, "", { "sec-fetch-site": "cross-site" }),
        publication,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await PUT(
        request("PUT", { reaction: "helpful" }, "", { "content-type": "text/plain" }),
        publication,
      )
    ).status,
  ).toBe(415);
  expect((await PUT(request("PUT", { reaction: "x".repeat(4100) }), publication)).status).toBe(413);
  expect(mocks.set).not.toHaveBeenCalled();
});
it.each([
  { reaction: "👍" },
  {},
  { reaction: "helpful", actorId: "victim" },
  { reaction: null, contentId: "draft" },
])("rejects an invalid/injected command %j", async (body) => {
  expect((await PUT(request("PUT", body), publication)).status).toBe(400);
  expect(mocks.set).not.toHaveBeenCalled();
});
it("scopes private history and unavailable-target cleanup to the session account", async () => {
  expect((await page(request("GET", undefined, "?q=Lua&reaction=thanks"))).status).toBe(200);
  expect(mocks.page).toHaveBeenCalledWith(actor, {
    query: "Lua",
    reaction: "thanks",
    cursor: undefined,
  });
  const response = await DELETE(request("DELETE", {}), cleanup);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ contentId: "content", removed: true });
  expect(mocks.remove).toHaveBeenCalledWith(actor, "content");
  expect((await DELETE(request("DELETE", { actorId: "victim" }), cleanup)).status).toBe(400);
});
it("denies anonymous private history and cleanup", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await page(request())).status).toBe(401);
  expect((await DELETE(request("DELETE", {}), cleanup)).status).toBe(401);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
it.each(["?actorId=victim", "?q=a&q=b", "?reaction=bad", "?cursor=bad"])(
  "rejects private filter injection %s before querying",
  async (query) => {
    expect((await page(request("GET", undefined, query))).status).toBe(400);
    expect(mocks.page).not.toHaveBeenCalled();
  },
);
it("reads public trust without a session or private request parameters", async () => {
  const response = await trust(request(), profile);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.trust).toHaveBeenCalledWith("writer");
  expect((await trust(request("GET", undefined, "?includeProof=true"), profile)).status).toBe(400);
  expect((await state(request("GET", undefined, "?actorId=victim"), publication)).status).toBe(400);
});
it("returns localized safe errors without asserting success for self/archived/unknown failures", async () => {
  mocks.set.mockRejectedValue(new AppError("secret self detail", 403, "REACTION_SELF"));
  const self = await PUT(request("PUT", { reaction: "helpful" }), publication);
  expect(self.status).toBe(403);
  expect((await self.json()).error).toMatch(/Ваша публикация/u);
  mocks.state.mockRejectedValue(new AppError("draft title", 404, "NOT_FOUND"));
  expect((await state(request(), publication)).status).toBe(404);
  mocks.trust.mockRejectedValue(new Error("secret SQL proof"));
  const failure = await trust(request(), profile);
  expect(failure.status).toBe(503);
  const data = await failure.json();
  expect(data.error).toMatch(/Не удалось/u);
  expect(JSON.stringify(data)).not.toContain("secret SQL");
});
it("limits reads and both mutation paths with shared policies", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await state(request(), publication)).status).toBe(429);
  expect((await page(request())).status).toBe(429);
  expect((await trust(request(), profile)).status).toBe(429);
  expect((await PUT(request("PUT", { reaction: null }), publication)).status).toBe(429);
  expect((await DELETE(request("DELETE", {}), cleanup)).status).toBe(429);
  expect(mocks.set).not.toHaveBeenCalled();
  expect(mocks.remove).not.toHaveBeenCalled();
});
