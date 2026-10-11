import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";
const mocks = vi.hoisted(() => ({
  article: vi.fn(),
  pageDiscussion: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { getArticleBySlug: mocks.article, pageDiscussion: mocks.pageDiscussion },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getUserById: async () => null, getSession: async () => null },
}));
import Page from "../apps/web/src/app/articles/[slug]/page";
vi.mock("../apps/web/src/lib/services/content-reaction-service", () => ({
  contentReactionService: { state: async () => null },
}));
import { ContentDiscussion } from "../apps/web/src/components/content-discussion";
const item = {
  id: "older",
  text: "Older targeted reply",
  parentId: "parent",
  parent: { text: "Parent text", username: "writer" },
  createdAt: "2026-10-11T00:00:00.000Z",
  author: { id: "author", username: "writer", displayName: "Writer", avatarUrl: null },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.article.mockResolvedValue({
    id: "content",
    slug: "article",
    title: "Public article",
    body: "Body",
    type: "article",
    authorId: "author",
    tags: [],
    createdAt: new Date(),
    commentCount: 50,
    viewCount: 0,
    likeCount: 0,
  });
  mocks.pageDiscussion.mockResolvedValue({ items: [item], hasMore: true, nextCursor: "cursor" });
});
it.each(["en", "ru"] as const)(
  "server-loads an older linked comment with search, highlighted context and parent permalink in %s",
  async (locale) => {
    mocks.locale = locale;
    const html = renderToStaticMarkup(
      await Page({
        params: Promise.resolve({ slug: "article" }),
        searchParams: Promise.resolve({ comment: "older" }),
      }),
    );
    expect(mocks.pageDiscussion).toHaveBeenCalledWith("content", undefined, {
      query: "",
      focusId: "older",
    });
    expect(html).toContain("Older targeted reply");
    expect(html).toContain(getDiscussionCopy(locale).focused);
    expect(html).toContain(getDiscussionCopy(locale).search);
    expect(html).toContain('href="/articles/article?comment=parent#comment-parent"');
    expect(html).toContain('href="/articles/article?comment=older#comment-older"');
  },
);
it("passes normalized search to server paging and renders a localized empty result", async () => {
  mocks.pageDiscussion.mockResolvedValue({ items: [], hasMore: false, nextCursor: null });
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "article" }),
      searchParams: Promise.resolve({ q: " Lua " }),
    }),
  );
  expect(mocks.pageDiscussion).toHaveBeenCalledWith("content", undefined, {
    query: "Lua",
    focusId: undefined,
  });
  expect(html).toContain(getDiscussionCopy("en").noMatches);
  expect(html).toContain('value="Lua"');
});
it("offers latest-discussion recovery after a deleted focused comment without rendering internal errors", async () => {
  mocks.pageDiscussion.mockRejectedValue(
    new AppError("private details", 404, "COMMENT_FOCUS_NOT_FOUND"),
  );
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "article" }),
      searchParams: Promise.resolve({ comment: "deleted" }),
    }),
  );
  expect(html).toContain(getDiscussionCopy("en").focusMissing);
  expect(html).not.toContain("private details");
});
it("does not query comments for malformed or repeated discussion selectors", async () => {
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "article" }),
      searchParams: Promise.resolve({ comment: ["a", "b"] }),
    }),
  );
  expect(mocks.pageDiscussion).not.toHaveBeenCalled();
  expect(html).toContain(getDiscussionCopy("en").invalidCursor);
});
it("renders standalone search error and empty states without requiring browser effects", () => {
  const html = renderToStaticMarkup(
    <ContentDiscussion
      slug="article"
      contentId="content"
      locale="ru"
      count={0}
      initial={{ items: [], hasMore: false, nextCursor: null }}
      initialQuery="Lua"
    />,
  );
  expect(html).toContain(getDiscussionCopy("ru").noMatches);
  expect(html).toContain(getDiscussionCopy("ru").applySearch);
});
