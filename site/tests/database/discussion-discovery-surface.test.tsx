import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getDiscussionCopy } from "../../src/lib/content-discussion-copy";

const mocks = vi.hoisted(() => ({
  article: vi.fn(),
  pageDiscussion: vi.fn(),
  locale: "en" as "en" | "ru",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../src/lib/services/content-service", () => ({
  contentService: { getArticleBySlug: mocks.article, pageDiscussion: mocks.pageDiscussion },
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getUserById: async () => null, getSession: async () => null },
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/articles/article" }));

import Page from "../../src/app/articles/[slug]/page";

vi.mock("../../src/lib/services/content-reaction-service", () => ({
  contentReactionService: { state: async () => null },
}));

import { ContentDiscussion } from "../../src/components/content-discussion";

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
  const copy = getDiscussionCopy("en");
  expect(html).toContain(copy.noMatches);
  expect(html).toContain(copy.noMatchesDescription);
  expect(html).toContain(copy.clearSearch);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('value="Lua"');
});
it("offers ErrorState recovery after a deleted focused comment without rendering internal errors", async () => {
  mocks.pageDiscussion.mockRejectedValue(
    new AppError("private details", 404, "COMMENT_FOCUS_NOT_FOUND"),
  );
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ slug: "article" }),
      searchParams: Promise.resolve({ comment: "deleted" }),
    }),
  );
  const copy = getDiscussionCopy("en");
  expect(html).toContain(copy.focusMissing);
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.returnDiscussion);
  expect(html).toContain(copy.retry);
  expect(html).toContain("overflow-x-clip");
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
  expect(html).toContain('role="alert"');
  expect(html).toContain("overflow-x-clip");
});
it("renders standalone search EmptyState without requiring browser effects", () => {
  const copy = getDiscussionCopy("ru");
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
  expect(html).toContain(copy.noMatches);
  expect(html).toContain(copy.noMatchesDescription);
  expect(html).toContain(copy.applySearch);
  expect(html).toContain("overflow-x-clip");
});
it.each(["en", "ru"] as const)(
  "renders working discussion subscription entry points and settings in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <ContentDiscussion
        slug="article"
        contentId="content"
        title="Current article"
        locale={locale}
        count={0}
        initial={{ items: [], hasMore: false, nextCursor: null }}
      />,
    );
    expect(html).toContain('href="/workspace/saved?type=content"');
    expect(html).toContain('href="/settings#notification-heading"');
    expect(html).toContain('href="/auth/login?next=%2Farticles%2Farticle"');
    expect(html).toContain("min-h-11");
    expect(html).toContain("overflow-x-clip");
    expect(html).not.toContain("Checking");
  },
);
