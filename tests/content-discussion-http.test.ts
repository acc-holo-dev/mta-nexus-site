import { expect, it, vi } from "vitest";

vi.mock("next/server", async () => {
  const { contentDiscussionHttpState } = await import("./helpers/content-discussion-http-harness");
  return {
    ...(await vi.importActual<typeof import("next/server")>("next/server")),
    after: (callback: () => Promise<unknown>) => {
      if (contentDiscussionHttpState.registrationFails) throw Error("runtime-private");
      contentDiscussionHttpState.after.push(callback);
    },
  };
});

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { contentDiscussionHttpState } = await import("./helpers/content-discussion-http-harness");
  return {
    authService: { getSession: async () => contentDiscussionHttpState.actor },
  };
});

vi.mock("../apps/web/src/lib/services/content-service", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return {
    contentService: {
      getArticleBySlug: contentDiscussionHttpMocks.article,
      pageDiscussion: contentDiscussionHttpMocks.page,
      addComment: contentDiscussionHttpMocks.add,
      commentAuthor: contentDiscussionHttpMocks.parent,
    },
  };
});

vi.mock("../apps/web/src/lib/services/discussion-follow-notification-service", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return {
    notifyDiscussionReplies: contentDiscussionHttpMocks.notify,
  };
});

vi.mock("@nexus/security", async () => {
  const { contentDiscussionHttpMocks } = await import("./helpers/content-discussion-http-harness");
  return { consumeRateLimit: contentDiscussionHttpMocks.rate };
});

import { GET } from "../apps/web/src/app/api/content/[slug]/comments/route";
import {
  contentDiscussionHttpContext as context,
  contentDiscussionHttpMocks as mocks,
  contentDiscussionHttpRequest as request,
  contentDiscussionHttpState as state,
  installContentDiscussionHttpLifecycle,
} from "./helpers/content-discussion-http-harness";

installContentDiscussionHttpLifecycle();

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
it("passes normalized text search and focused comment selectors without recording views", async () => {
  expect((await GET(request("GET", undefined, "?q=%20Lua%20"), context)).status).toBe(200);
  expect(mocks.page).toHaveBeenLastCalledWith("content", undefined, {
    query: "Lua",
    focusId: undefined,
  });
  expect((await GET(request("GET", undefined, "?comment=older"), context)).status).toBe(200);
  expect(mocks.page).toHaveBeenLastCalledWith("content", undefined, {
    query: "",
    focusId: "older",
  });
});
it.each([
  "?q=one&q=two",
  "?comment=x&comment=y",
  "?comment=x&q=Lua",
  "?comment=x&cursor=x",
  "?actorId=victim",
  `?q=${"x".repeat(121)}`,
])("rejects invalid discovery selectors %s before querying", async (query) => {
  expect((await GET(request("GET", undefined, query), context)).status).toBe(400);
  expect(mocks.article).not.toHaveBeenCalled();
});
it("rate-limits public discussion lookup before loading its article", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await GET(request("GET", undefined, "?q=Lua"), context)).status).toBe(429);
  expect(mocks.article).not.toHaveBeenCalled();
});
