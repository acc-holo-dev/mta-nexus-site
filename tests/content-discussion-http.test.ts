import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  actor: { id: "commenter", username: "writer" } as Record<string, unknown> | null,
  after: [] as (() => Promise<unknown>)[],
}));
const mocks = vi.hoisted(() => ({
  article: vi.fn(),
  page: vi.fn(),
  add: vi.fn(),
  parent: vi.fn(),
  rate: vi.fn(),
  notify: vi.fn(),
}));
vi.mock("next/server", async () => ({
  ...(await vi.importActual<typeof import("next/server")>("next/server")),
  after: (callback: () => Promise<unknown>) => state.after.push(callback),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    getArticleBySlug: mocks.article,
    pageDiscussion: mocks.page,
    addComment: mocks.add,
    commentAuthor: mocks.parent,
  },
}));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: mocks.notify,
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
import { GET, POST } from "../apps/web/src/app/api/content/[slug]/comments/route";
const context = { params: Promise.resolve({ slug: "article" }) };
function request(method: string, body?: unknown, query = "", locale = "en", headers = {}) {
  return new NextRequest(`http://nexus.test/api/content/article/comments${query}`, {
    method,
    headers: {
      cookie: `nexus_locale=${locale};nexus_session=test`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "commenter", username: "writer" };
  state.after = [];
  mocks.article.mockResolvedValue({
    id: "content",
    slug: "article",
    title: "Article",
    authorId: "author",
  });
  mocks.page.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  mocks.add.mockImplementation(async (input) => ({
    ...input,
    id: "comment",
    authorId: "commenter",
  }));
  mocks.parent.mockResolvedValue("parentAuthor");
  mocks.rate.mockResolvedValue({ success: true });
  mocks.notify.mockResolvedValue({ stored: 1 });
});
it("allows anonymous paged public reads without increasing views", async () => {
  state.actor = null;
  const cursor = { createdAt: "2026-10-10T12:00:00.000123Z", id: "cmt" };
  const response = await GET(
    request("GET", undefined, `?${new URLSearchParams({ cursor: JSON.stringify(cursor) })}`),
    context,
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(mocks.article).toHaveBeenCalledWith("article", { incrementView: false });
  expect(mocks.page).toHaveBeenCalledWith("content", cursor);
});
it.each(["?cursor=oops", "?cursor=x&cursor=y", `?cursor=${"x".repeat(600)}`])(
  "rejects malformed or duplicated cursors %s before querying",
  async (query) => {
    expect((await GET(request("GET", undefined, query), context)).status).toBe(400);
    expect(mocks.article).not.toHaveBeenCalled();
  },
);
it("does not read discussions for drafts or missing content", async () => {
  mocks.article.mockResolvedValue(null);
  expect((await GET(request("GET"), context)).status).toBe(404);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("persists a reply before notifying both distinct recipients", async () => {
  const response = await POST(
    request("POST", { text: " A useful reply ", parentId: "parent" }),
    context,
  );
  expect(response.status).toBe(201);
  expect(mocks.add).toHaveBeenCalledWith(
    { contentId: "content", text: "A useful reply", parentId: "parent" },
    state.actor,
  );
  expect(mocks.notify).not.toHaveBeenCalled();
  await state.after[0]();
  expect(mocks.notify.mock.calls[0][0].map((v: { recipientId: string }) => v.recipientId)).toEqual([
    "author",
    "parentAuthor",
  ]);
  expect(mocks.notify.mock.calls[0][0][0].link).toBe("/articles/article?comment=comment#comment-comment");
});
it("passes normalized text search and focused comment selectors without recording views", async () => {
  expect((await GET(request("GET", undefined, "?q=%20Lua%20"), context)).status).toBe(200);
  expect(mocks.page).toHaveBeenLastCalledWith("content", undefined, { query: "Lua", focusId: undefined });
  expect((await GET(request("GET", undefined, "?comment=older"), context)).status).toBe(200);
  expect(mocks.page).toHaveBeenLastCalledWith("content", undefined, { query: "", focusId: "older" });
});
it.each(["?q=one&q=two", "?comment=x&comment=y", "?comment=x&q=Lua", "?comment=x&cursor=x", "?actorId=victim", `?q=${"x".repeat(121)}`])(
  "rejects invalid discovery selectors %s before querying", async (query) => {
    expect((await GET(request("GET", undefined, query), context)).status).toBe(400);
    expect(mocks.article).not.toHaveBeenCalled();
  },
);
it("rate-limits public discussion lookup before loading its article", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await GET(request("GET", undefined, "?q=Lua"), context)).status).toBe(429);
  expect(mocks.article).not.toHaveBeenCalled();
});
it("deduplicates parent and content authors and omits self notifications", async () => {
  mocks.parent.mockResolvedValue("author");
  await POST(request("POST", { text: "Reply", parentId: "parent" }), context);
  await state.after[0]();
  expect(mocks.notify.mock.calls[0][0]).toHaveLength(1);
});
it.each([1, 5001])("rejects comment length %s", async (length) => {
  expect((await POST(request("POST", { text: "x".repeat(length) }), context)).status).toBe(400);
  expect(mocks.add).not.toHaveBeenCalled();
});
it("aligns the 5000-character form and write contract", async () => {
  expect((await POST(request("POST", { text: "x".repeat(5000) }), context)).status).toBe(201);
});
it("keeps writes private and requires authentication, JSON and same-site requests", async () => {
  state.actor = null;
  const anonymous = await POST(request("POST", { text: "reply" }), context);
  expect(anonymous.status).toBe(401);
  expect(anonymous.headers.get("cache-control")).toBe("private, no-store");
  state.actor = { id: "commenter", username: "writer" };
  expect(
    (
      await POST(
        request("POST", { text: "reply" }, "", "en", { "content-type": "text/plain" }),
        context,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await POST(
        request("POST", { text: "reply" }, "", "en", { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
});
it("localizes revoked publication/parent errors and suppresses side effects", async () => {
  mocks.add.mockRejectedValue(new AppError("Private detail", 400, "COMMENT_PARENT_NOT_FOUND"));
  const response = await POST(
    request("POST", { text: "reply", parentId: "parent" }, "", "ru"),
    context,
  );
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "COMMENT_PARENT_NOT_FOUND" });
  expect(state.after).toHaveLength(0);
});
it("rejects oversized bodies and rate-limited writes", async () => {
  expect((await POST(request("POST", { text: "x".repeat(40000) }), context)).status).toBe(413);
  mocks.rate.mockResolvedValue({ success: false });
  expect((await POST(request("POST", { text: "reply" }), context)).status).toBe(429);
  expect(mocks.add).not.toHaveBeenCalled();
});
