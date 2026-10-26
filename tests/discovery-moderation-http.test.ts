import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  stream: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
  command: vi.fn(),
  session: vi.fn(),
  rate: vi.fn(),
  ip: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { stream: mocks.stream },
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: { page: mocks.page, detail: mocks.detail, command: mocks.command },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({ getTrustedRequestIp: mocks.ip }));
import { GET as stream } from "../apps/web/src/app/api/discover/stream/route";
import { GET as page } from "../apps/web/src/app/api/admin/community/route";
import { GET as detail, POST as command } from "../apps/web/src/app/api/admin/community/[id]/route";
const actor = { id: "actor", role: "moderator" },
  context = { params: Promise.resolve({ id: "item" }) };
function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://nexus.test${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.ip.mockReturnValue("trusted-ip");
  mocks.stream.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.page.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.detail.mockResolvedValue({ item: { id: "item" } });
  mocks.command.mockResolvedValue({
    id: "item",
    action: "archive",
    status: "archived",
    updatedAt: "2026-10-11T00:00:01Z",
  });
});
it("serves anonymous cursor directories with trusted-IP rate limiting and public no-store", async () => {
  const response = await stream(request("/api/discover/stream?type=servers&q=Lua&language=ru"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(mocks.rate).toHaveBeenCalledWith("search", "trusted-ip");
  expect(mocks.stream).toHaveBeenCalledWith(
    expect.objectContaining({ type: "servers", query: "Lua", language: "ru" }),
  );
  expect(mocks.session).not.toHaveBeenCalled();
});
it.each(["?sort=name", "?type=resources", "?page=3", "?cursor=bad", "?actorId=other"])(
  "rejects incompatible discovery request %s before selection",
  async (query) => {
    expect((await stream(request(`/api/discover/stream${query}`))).status).toBe(400);
    expect(mocks.stream).not.toHaveBeenCalled();
  },
);
it("reads a private moderation queue under session identity and prevents caching", async () => {
  const response = await page(request("/api/admin/community?status=all&type=post&author=Writer"));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(response.headers.get("Vary")).toBe("Cookie");
  expect(mocks.page).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({ status: undefined, type: "post", author: "Writer" }),
  );
});
it("loads a private detail through the staff service", async () => {
  expect((await detail(request("/api/admin/community/item"), context)).status).toBe(200);
  expect(mocks.detail).toHaveBeenCalledWith(actor, "item", undefined);
});
it.each([page, async (r: NextRequest) => detail(r, context)])(
  "requires an authenticated session before private selection",
  async (read) => {
    mocks.session.mockResolvedValueOnce(null);
    expect((await read(request("/api/admin/community"))).status).toBe(401);
    expect(mocks.page).not.toHaveBeenCalled();
    expect(mocks.detail).not.toHaveBeenCalled();
  },
);
const valid = {
  action: "archive",
  notes: "Причина решения",
  expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
};
it("saves a strict observed-version command under session identity", async () => {
  const response = await command(request("/api/admin/community/item", valid), context);
  expect(response.status).toBe(200);
  expect(mocks.command).toHaveBeenCalledWith(actor, "item", valid);
  expect(mocks.rate).toHaveBeenCalledWith("moderationAction", "actor");
});
it.each([
  { ...valid, actorId: "other" },
  { ...valid, notes: "x" },
  { ...valid, expectedUpdatedAt: "bad" },
  { ...valid, action: "delete" },
])("rejects injected/incomplete decisions %j before mutation", async (body) => {
  expect((await command(request("/api/admin/community/item", body), context)).status).toBe(400);
  expect(mocks.command).not.toHaveBeenCalled();
});
it("denies cross-site commands and oversized bodies before mutations", async () => {
  expect(
    (
      await command(
        request("/api/admin/community/item", valid, { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await command(
        request("/api/admin/community/item", { ...valid, notes: "x".repeat(20000) }),
        context,
      )
    ).status,
  ).toBe(413);
  expect(mocks.command).not.toHaveBeenCalled();
});
it("keeps revoked-authority failures and private infrastructure failures localized without details", async () => {
  mocks.detail.mockRejectedValueOnce(new AppError("PRIVATE", 403, "FORBIDDEN"));
  const denied = await detail(request("/api/admin/community/item"), context);
  expect(denied.status).toBe(403);
  expect(JSON.stringify(await denied.json())).not.toContain("PRIVATE");
  mocks.command.mockRejectedValueOnce(new Error("PRIVATE_DATABASE"));
  const failed = await command(request("/api/admin/community/item", valid), context);
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain("PRIVATE_DATABASE");
});
it("stops rate-limited stream and staff writes before their services", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await stream(request("/api/discover/stream"))).status).toBe(429);
  expect((await command(request("/api/admin/community/item", valid), context)).status).toBe(429);
  expect(mocks.stream).not.toHaveBeenCalled();
  expect(mocks.command).not.toHaveBeenCalled();
});
