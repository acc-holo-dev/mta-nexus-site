import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  own: vi.fn(),
  mutate: vi.fn(),
  approvals: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/discussion-workspace-service", () => ({
  discussionWorkspaceService: { page: mocks.page, own: mocks.own, mutate: mocks.mutate },
}));
vi.mock("../apps/web/src/lib/services/public-verification-history-service", () => ({
  publicVerificationHistoryService: { page: mocks.approvals },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "trusted-ip",
}));
import { GET as page } from "../apps/web/src/app/api/workspace/discussions/route";
import {
  GET as own,
  PATCH,
  DELETE,
} from "../apps/web/src/app/api/workspace/discussions/[id]/route";
import { GET as approvals } from "../apps/web/src/app/api/users/[username]/trust/history/route";
const actor = { id: "actor", role: "admin" },
  revision = "a".repeat(64),
  comment = { params: Promise.resolve({ id: "comment" }) },
  profile = { params: Promise.resolve({ username: "writer" }) };
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api${query}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : browserMutationHeaders()),
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.page.mockResolvedValue({ items: [] });
  mocks.own.mockResolvedValue({ id: "comment" });
  mocks.mutate.mockResolvedValue({ commentId: "comment", removed: true });
  mocks.approvals.mockResolvedValue({ items: [] });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("scopes private page/detail to session and marks both responses private/no-store", async () => {
  const response = await page(request("GET", undefined, "?q=Lua&availability=unavailable"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.page).toHaveBeenCalledWith(actor, {
    query: "Lua",
    availability: "unavailable",
    cursor: undefined,
  });
  expect((await own(request(), comment)).status).toBe(200);
  expect(mocks.own).toHaveBeenCalledWith(actor, "comment");
  expect(mocks.rate).toHaveBeenCalledWith("search", "actor");
});
it("passes validated revision commands to the server with no client roles or context", async () => {
  expect(
    (await PATCH(request("PATCH", { text: " Edited ", expectedRevision: revision }), comment))
      .status,
  ).toBe(200);
  expect(mocks.mutate).toHaveBeenLastCalledWith(actor, "comment", {
    text: "Edited",
    expectedRevision: revision,
  });
  expect((await DELETE(request("DELETE", { expectedRevision: revision }), comment)).status).toBe(
    200,
  );
  expect(mocks.mutate).toHaveBeenLastCalledWith(actor, "comment", { expectedRevision: revision });
  expect(mocks.rate).toHaveBeenCalledWith("commentEditing", "actor");
});
it.each([
  { text: "Edit", expectedRevision: revision, actorId: "victim" },
  { text: "Edit", expectedRevision: revision, contentId: "draft" },
  { text: "Edit", expectedRevision: "bad" },
  { text: "x", expectedRevision: revision },
])("rejects invalid or injected edit %j", async (body) => {
  expect((await PATCH(request("PATCH", body), comment)).status).toBe(400);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it.each([
  { expectedRevision: revision, reason: "Override" },
  { expectedRevision: revision, ownWorkspace: true },
  {},
])("rejects removal command injection %j", async (body) => {
  expect((await DELETE(request("DELETE", body), comment)).status).toBe(400);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it.each(["?actorId=victim", "?availability=bad", "?q=a&q=b", "?cursor=bad"])(
  "rejects own filter injection before read %s",
  async (query) => {
    expect((await page(request("GET", undefined, query))).status).toBe(400);
    expect(mocks.page).not.toHaveBeenCalled();
  },
);
it("rejects any detail/mutation query override", async () => {
  expect((await own(request("GET", undefined, "?actorId=victim"), comment)).status).toBe(400);
  expect(
    (await DELETE(request("DELETE", { expectedRevision: revision }, "?contentId=draft"), comment))
      .status,
  ).toBe(400);
  expect(mocks.own).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("requires session for every private read and write", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await page(request())).status).toBe(401);
  expect((await own(request(), comment)).status).toBe(401);
  expect(
    (await PATCH(request("PATCH", { text: "Edit", expectedRevision: revision }), comment)).status,
  ).toBe(401);
  expect((await DELETE(request("DELETE", { expectedRevision: revision }), comment)).status).toBe(
    401,
  );
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("rejects cross-site, non-JSON and oversized actual bodies before mutation", async () => {
  expect(
    (
      await PATCH(
        request("PATCH", { text: "Edit", expectedRevision: revision }, "", {
          "sec-fetch-site": "cross-site",
        }),
        comment,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await DELETE(
        request("DELETE", { expectedRevision: revision }, "", { "content-type": "text/plain" }),
        comment,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await PATCH(
        request("PATCH", { text: "x".repeat(33 * 1024), expectedRevision: revision }),
        comment,
      )
    ).status,
  ).toBe(413);
  expect(mocks.mutate).not.toHaveBeenCalled();
});
it("reads public approvals anonymously with trusted-IP limits and no proof options", async () => {
  const response = await approvals(request("GET", undefined, "?type=developer"), profile);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.session).not.toHaveBeenCalled();
  expect(mocks.rate).toHaveBeenCalledWith("search", "trusted-ip");
  expect(mocks.approvals).toHaveBeenCalledWith("writer", { type: "developer", cursor: undefined });
  mocks.approvals.mockClear();
  expect((await approvals(request("GET", undefined, "?includeProof=true"), profile)).status).toBe(
    400,
  );
  expect(mocks.approvals).not.toHaveBeenCalled();
});
it("localizes stale/unavailable/missing and infrastructure errors without leaking hidden data", async () => {
  mocks.mutate.mockRejectedValue(new AppError("private title", 409, "DISCUSSION_UNAVAILABLE"));
  const conflict = await PATCH(
    request("PATCH", { text: "Edit", expectedRevision: revision }),
    comment,
  );
  expect(conflict.status).toBe(409);
  expect((await conflict.json()).error).toMatch(/сохранённое состояние/u);
  mocks.own.mockRejectedValue(new AppError("foreign", 404, "NOT_FOUND"));
  expect((await own(request(), comment)).status).toBe(404);
  mocks.approvals.mockRejectedValue(new Error("secret proof SQL"));
  const failed = await approvals(request(), profile);
  expect(failed.status).toBe(503);
  expect(JSON.stringify(await failed.json())).not.toContain("secret");
  mocks.approvals.mockRejectedValue(new AppError("other user", 400, "INVALID_CURSOR"));
  expect((await approvals(request(), profile)).status).toBe(400);
});
it("applies shared rate limits to all new read/write paths", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await page(request())).status).toBe(429);
  expect((await own(request(), comment)).status).toBe(429);
  expect((await approvals(request(), profile)).status).toBe(429);
  expect(
    (await PATCH(request("PATCH", { text: "Edit", expectedRevision: revision }), comment)).status,
  ).toBe(429);
  expect((await DELETE(request("DELETE", { expectedRevision: revision }), comment)).status).toBe(
    429,
  );
  expect(mocks.page).not.toHaveBeenCalled();
  expect(mocks.mutate).not.toHaveBeenCalled();
  expect(mocks.approvals).not.toHaveBeenCalled();
});
