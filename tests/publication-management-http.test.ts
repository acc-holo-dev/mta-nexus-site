import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  resolve: vi.fn(),
  manage: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { page: mocks.page, resolve: mocks.resolve },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { manageComment: mocks.manage },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "trusted-ip",
}));
import { GET as following } from "../apps/web/src/app/api/workspace/feed/route";
import { GET as activity } from "../apps/web/src/app/api/activity/[kind]/[handle]/route";
import { PATCH, DELETE } from "../apps/web/src/app/api/content/[slug]/comments/[id]/route";
const actor = { id: "actor", role: "user" },
  expectedRevision = "a".repeat(64);
const comment = { params: Promise.resolve({ slug: "article", id: "comment" }) };
const profile = { params: Promise.resolve({ kind: "user", handle: "writer" }) };
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`http://nexus.test/api/workspace/feed${query}`, {
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
  mocks.resolve.mockResolvedValue({ id: "profile", name: "Writer" });
  mocks.page.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.manage.mockResolvedValue({ contentId: "content", commentId: "comment", removed: true });
});
it("reads a private feed using only session identity with no-store headers", async () => {
  const response = await following(request("GET", undefined, "?source=user&type=post&q=Lua"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.page).toHaveBeenCalledWith(
    { kind: "following", actorId: "actor" },
    { source: "user", type: "post", query: "Lua", cursor: undefined },
  );
});
it("denies anonymous feed reads and actor/cursor injections before querying", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await following(request())).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  for (const query of ["?actorId=victim", "?cursor=bad", "?q=x&q=y"])
    expect((await following(request("GET", undefined, query))).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("reads public activity anonymously with a narrow resolved scope", async () => {
  mocks.session.mockResolvedValue(null);
  const response = await activity(request("GET", undefined, "?type=news"), profile);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("public, max-age=15");
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.resolve).toHaveBeenCalledWith("user", "writer");
  expect(mocks.page).toHaveBeenCalledWith(
    { kind: "user", id: "profile" },
    expect.objectContaining({ type: "news" }),
  );
  expect(mocks.rate).toHaveBeenCalledWith("search", "trusted-ip");
});
it("rejects invalid public kinds and follow-only filters", async () => {
  expect(
    (await activity(request(), { params: Promise.resolve({ kind: "product", handle: "writer" }) }))
      .status,
  ).toBe(404);
  expect((await activity(request("GET", undefined, "?source=user"), profile)).status).toBe(400);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("returns localized safe errors for unknown feed failures and missing profiles", async () => {
  mocks.page.mockRejectedValue(new Error("secret SQL details"));
  const response = await following(request());
  expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("secret SQL");
  mocks.resolve.mockRejectedValue(new AppError("private profile", 404, "NOT_FOUND"));
  const missing = await activity(request(), profile);
  expect(missing.status).toBe(404);
  expect(missing.headers.get("cache-control")).toBe("no-store");
});
it("persists normalized own edits and moderation reasons through the service", async () => {
  expect(
    (await PATCH(request("PATCH", { text: " Updated text ", expectedRevision }), comment)).status,
  ).toBe(200);
  expect(mocks.manage).toHaveBeenCalledWith(
    { slug: "article", commentId: "comment", text: "Updated text", expectedRevision },
    actor,
  );
  expect(
    (await DELETE(request("DELETE", { expectedRevision, reason: " Spam " }), comment)).status,
  ).toBe(200);
  expect(mocks.manage).toHaveBeenLastCalledWith(
    { slug: "article", commentId: "comment", expectedRevision, reason: "Spam" },
    actor,
  );
});
it("requires authentication, same-site mutation, JSON and bounded payloads", async () => {
  const body = { text: "Edit", expectedRevision };
  mocks.session.mockResolvedValue(null);
  expect((await PATCH(request("PATCH", body), comment)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  expect(
    (await PATCH(request("PATCH", body, "", { "sec-fetch-site": "cross-site" }), comment)).status,
  ).toBe(403);
  expect(
    (await PATCH(request("PATCH", body, "", { "content-type": "text/plain" }), comment)).status,
  ).toBe(415);
  expect(
    (await PATCH(request("PATCH", { text: "x".repeat(40000), expectedRevision }), comment)).status,
  ).toBe(413);
  expect(mocks.manage).not.toHaveBeenCalled();
});
it.each([
  { text: "Edit" },
  { text: "x", expectedRevision },
  { text: "x".repeat(5001), expectedRevision },
  { text: "Edit", expectedRevision, actorId: "victim" },
  { text: "Edit", expectedRevision, productId: "product" },
])("rejects invalid comment command %j", async (body) => {
  expect((await PATCH(request("PATCH", body), comment)).status).toBe(400);
  expect(mocks.manage).not.toHaveBeenCalled();
});
it("returns CAS/permission errors privately without claiming success", async () => {
  mocks.manage.mockRejectedValue(new AppError("internal detail", 409, "COMMENT_CHANGED"));
  const response = await PATCH(request("PATCH", { text: "Edit", expectedRevision }), comment);
  expect(response.status).toBe(409);
  const payload = await response.json();
  expect(payload.code).toBe("COMMENT_CHANGED");
  expect(payload.error).toMatch(/изменился/u);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("limits feed reads and comment mutations", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await following(request())).status).toBe(429);
  expect((await activity(request(), profile)).status).toBe(429);
  expect((await DELETE(request("DELETE", { expectedRevision }), comment)).status).toBe(429);
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.manage).not.toHaveBeenCalled();
});
