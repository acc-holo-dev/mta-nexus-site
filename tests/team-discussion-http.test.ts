import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  previewMembers: vi.fn(),
  batchMembers: vi.fn(),
  discussion: vi.fn(),
  discussionDetail: vi.fn(),
  removeDiscussion: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/organization-workspace-service", () => ({
  organizationWorkspaceService: state,
}));
vi.mock("../apps/web/src/lib/services/community-moderation-service", () => ({
  communityModerationService: state,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import {
  GET as detail,
  POST as remove,
} from "../apps/web/src/app/api/admin/community/[id]/discussion/[commentId]/route";
import { GET as page } from "../apps/web/src/app/api/admin/community/[id]/discussion/route";
import { POST as preview } from "../apps/web/src/app/api/workspace/organizations/[id]/members/batch/preview/route";
import { POST as batch } from "../apps/web/src/app/api/workspace/organizations/[id]/members/batch/route";

const context = { params: Promise.resolve({ id: "org", commentId: "comment" }) };
const request = (
  method = "GET",
  query = "",
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new NextRequest(`https://nexus.test/api/example${query}`, {
    method,
    headers: {
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const input = {
  userIds: ["member"],
  expectedUpdatedAt: "2026-10-11T00:00:00.000Z",
  change: { action: "remove" },
  previewRevision: "a".repeat(64),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.session.mockResolvedValue({ id: "actor", role: "moderator" });
  state.rate.mockResolvedValue({ success: true });
  for (const method of [
    state.previewMembers,
    state.batchMembers,
    state.discussion,
    state.discussionDetail,
    state.removeDiscussion,
  ])
    method.mockResolvedValue({ ok: true });
});
it("passes private bulk review and command through existing session and management rate protection", async () => {
  for (const [route, method] of [
    [preview, state.previewMembers],
    [batch, state.batchMembers],
  ] as const) {
    const result = await route(request("POST", "", input), context);
    expect(result.status).toBe(200);
    expect(result.headers.get("cache-control")).toBe("private, no-store");
    expect(result.headers.get("vary")).toBe("Cookie");
    expect(method).toHaveBeenCalledWith("org", input, { id: "actor", role: "moderator" });
  }
  expect(state.rate).toHaveBeenCalledWith("organizationManagement", "actor");
});
it.each(["preview", "batch", "page", "detail", "remove"])(
  "requires session and rate allowance for %s",
  async (name) => {
    const call = () =>
      name === "preview"
        ? preview(request("POST", "", input), context)
        : name === "batch"
          ? batch(request("POST", "", input), context)
          : name === "page"
            ? page(request(), context)
            : name === "detail"
              ? detail(request(), context)
              : remove(request("POST", "", input), context);
    state.session.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    state.session.mockResolvedValue({ id: "actor" });
    state.rate.mockResolvedValue({ success: false });
    expect((await call()).status).toBe(429);
  },
);
it("rejects cross-site, injected query, media mismatch and excessive command bytes before service writes", async () => {
  for (const route of [preview, batch, remove]) {
    expect(
      (await route(request("POST", "", input, { "sec-fetch-site": "cross-site" }), context)).status,
    ).toBe(403);
    expect((await route(request("POST", "?actorId=foreign", input), context)).status).toBe(400);
    expect(
      (await route(request("POST", "", input, { "content-type": "text/plain" }), context)).status,
    ).toBe(415);
    expect((await route(request("POST", "", { text: "x".repeat(33000) }), context)).status).toBe(
      413,
    );
  }
  expect(state.previewMembers).not.toHaveBeenCalled();
  expect(state.batchMembers).not.toHaveBeenCalled();
  expect(state.removeDiscussion).not.toHaveBeenCalled();
});
it("scopes staff discussion reads, keeps exact search filters and rejects detail filter injection", async () => {
  const response = await page(request("GET", "?q=word&author=writer"), {
    params: Promise.resolve({ id: "post" }),
  });
  expect(response.status).toBe(200);
  expect(state.discussion).toHaveBeenCalledWith(
    expect.objectContaining({ id: "actor" }),
    "post",
    expect.objectContaining({ query: "word", author: "writer" }),
  );
  for (const query of ["?q=one&q=two", "?status=archived", "?cursor=bad", "?actorId=foreign"])
    expect(
      (await page(request("GET", query), { params: Promise.resolve({ id: "post" }) })).status,
    ).toBe(400);
  expect((await detail(request("GET", "?q=private"), context)).status).toBe(400);
});
it("returns localized stale-command failure with private headers", async () => {
  state.removeDiscussion.mockRejectedValue(new AppError("Comment changed", 409, "COMMENT_CHANGED"));
  const response = await remove(
    request("POST", "", { expectedRevision: "a".repeat(64), reason: "Reason" }),
    context,
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({
    code: "COMMENT_CHANGED",
    error: expect.stringContaining("Комментарий изменился"),
  });
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
