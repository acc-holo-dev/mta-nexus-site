import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PublicationFeed } from "../apps/web/src/components/publication-feed";
import { ContentDiscussion } from "../apps/web/src/components/content-discussion";
import { publicationCopy } from "../apps/web/src/lib/publication-feed-copy";
import { getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";
import {
  publicationPageQuery,
  type PublicationPage,
} from "../apps/web/src/lib/publication-feed-contract";
const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  session: vi.fn(),
  resolve: vi.fn(),
  article: vi.fn(),
  discussion: vi.fn(),
  author: vi.fn(),
  locale: "en" as "ru" | "en",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session, getUserById: mocks.author },
}));
vi.mock("../apps/web/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { page: mocks.page, resolve: mocks.resolve },
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { getArticleBySlug: mocks.article, pageDiscussion: mocks.discussion },
}));
import FollowingPage from "../apps/web/src/app/workspace/feed/page";
import UserActivity from "../apps/web/src/app/users/[username]/activity/page";
import ArticlePage from "../apps/web/src/app/articles/[slug]/page";
const time = "2026-10-10T12:00:00.000Z";
const row: PublicationPage["items"][number] = {
  id: "content",
  slug: "article",
  title: "<Title>",
  type: "question",
  excerpt: "<script>alert(1)</script>",
  image: null,
  commentCount: 3,
  publishedAt: time,
  author: { username: "writer", name: "Writer", avatar: null },
  organization: { name: "Team", href: "/organizations/team" },
  server: null,
  product: null,
  tags: ["Lua"],
};
const initial: PublicationPage = { items: [row], hasMore: true, nextCursor: "cursor" };
const comment = {
  id: "comment",
  revision: "a".repeat(64),
  text: "Original",
  parentId: null,
  parent: null,
  createdAt: time,
  author: { id: "author", username: "writer", displayName: "Writer", avatarUrl: null },
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.page.mockResolvedValue(initial);
  mocks.session.mockResolvedValue({ id: "author", role: "user" });
  mocks.resolve.mockResolvedValue({ id: "author", name: "Writer" });
  mocks.article.mockResolvedValue({
    id: "content",
    slug: "article",
    title: "Title",
    body: "Body",
    type: "post",
    authorId: "author",
    createdAt: time,
    tags: [],
    viewCount: 1,
    commentCount: 1,
    likeCount: 0,
  });
  mocks.discussion.mockResolvedValue({ items: [comment], hasMore: false, nextCursor: null });
  mocks.author.mockResolvedValue(null);
});
it.each(["en", "ru"] as const)(
  "renders publication filters, author context, safe text and bounded navigation in %s",
  (locale) => {
    const html = renderToStaticMarkup(
      <PublicationFeed
        initial={initial}
        filters={publicationPageQuery({ source: "organization", q: "Lua" })}
        locale={locale}
        path="/workspace/feed"
        following
      />,
    );
    expect(html).toContain(publicationCopy(locale).source);
    expect(html).toContain('name="type"');
    expect(html).toMatch(/maxlength="100"/iu);
    expect(html).toContain("/users/writer");
    expect(html).toContain("/organizations/team");
    expect(html).toContain("/articles/article#discussion");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain(publicationCopy(locale).next);
    expect(html).toContain("/workspace/saved");
  },
);
it("distinguishes unavailable reads, filtered empty results and empty following guidance", () => {
  const props = {
    filters: publicationPageQuery(),
    locale: "en" as const,
    path: "/workspace/feed",
    following: true,
  };
  const failure = renderToStaticMarkup(<PublicationFeed {...props} initial={null} />);
  expect(failure).toContain('role="alert"');
  expect(failure).not.toContain(publicationCopy("en").empty);
  const empty = renderToStaticMarkup(
    <PublicationFeed {...props} initial={{ items: [], hasMore: false, nextCursor: null }} />,
  );
  expect(empty).toContain(publicationCopy("en").emptyFollowing);
  expect(empty).toContain('href="/discover"');
  const filtered = renderToStaticMarkup(
    <PublicationFeed
      {...props}
      filters={publicationPageQuery({ type: "post" })}
      initial={{ items: [], hasMore: false, nextCursor: null }}
    />,
  );
  expect(filtered).toContain(publicationCopy("en").emptyFiltered);
});
it("uses authenticated SSR scope and presents login for anonymous feed", async () => {
  await FollowingPage({ searchParams: Promise.resolve({ source: "server", q: "MTA" }) });
  expect(mocks.page).toHaveBeenCalledWith(
    { kind: "following", actorId: "author" },
    expect.objectContaining({ source: "server", query: "MTA" }),
  );
  mocks.session.mockResolvedValue(null);
  mocks.page.mockClear();
  const html = renderToStaticMarkup(await FollowingPage());
  expect(html).toContain('href="/auth/login"');
  expect(mocks.page).not.toHaveBeenCalled();
});
it("restores a filtered following-feed page from its URL and rejects duplicate page parameters", async () => {
  const cursor = {
    createdAt: "2026-10-11T00:00:00.123456Z",
    id: "publication",
    context: "a".repeat(64),
    version: 1,
    direction: "older",
  };
  await FollowingPage({
    searchParams: Promise.resolve({
      source: "server",
      q: "MTA",
      author: "writer",
      tag: "Lua",
      cursor: JSON.stringify(cursor),
    }),
  });
  expect(mocks.page).toHaveBeenCalledWith(
    { kind: "following", actorId: "author" },
    expect.objectContaining({
      source: "server",
      query: "MTA",
      author: "writer",
      tag: "Lua",
      cursor,
    }),
  );
  mocks.page.mockClear();
  const invalid = renderToStaticMarkup(
    await FollowingPage({
      searchParams: Promise.resolve({ cursor: [JSON.stringify(cursor), JSON.stringify(cursor)] }),
    }),
  );
  expect(invalid).toContain(publicationCopy("en").invalid);
  expect(mocks.page).not.toHaveBeenCalled();
});
it("rejects follow-only filters on public author activity and offers recovery", async () => {
  const html = renderToStaticMarkup(
    await UserActivity({
      params: Promise.resolve({ username: "writer" }),
      searchParams: Promise.resolve({ source: "user" }),
    }),
  );
  expect(html).toContain('href="/users/writer"');
  expect(html).not.toContain('name="source"');
  expect(mocks.page).not.toHaveBeenCalled();
  expect(html).toContain(publicationCopy("en").invalid);
});
it.each(["en", "ru"] as const)(
  "exposes edit/remove only to the author and removal to moderators in %s",
  (locale) => {
    const props = {
      slug: "article",
      contentId: "content",
      locale,
      count: 1,
      initial: { items: [comment], hasMore: false, nextCursor: null },
    };
    const anonymous = renderToStaticMarkup(<ContentDiscussion {...props} />);
    expect(anonymous).not.toContain(getDiscussionCopy(locale).edit);
    expect(anonymous).not.toContain(getDiscussionCopy(locale).remove);
    const other = renderToStaticMarkup(
      <ContentDiscussion {...props} viewer={{ id: "other", canModerate: false }} />,
    );
    expect(other).not.toContain(getDiscussionCopy(locale).edit);
    const own = renderToStaticMarkup(
      <ContentDiscussion {...props} viewer={{ id: "author", canModerate: false }} />,
    );
    expect(own).toContain(getDiscussionCopy(locale).edit);
    expect(own).toContain(getDiscussionCopy(locale).remove);
    expect(own).not.toContain('href="/auth/login"');
    const moderator = renderToStaticMarkup(
      <ContentDiscussion {...props} viewer={{ id: "other", canModerate: true }} />,
    );
    expect(moderator).not.toContain(getDiscussionCopy(locale).edit);
    expect(moderator).toContain(getDiscussionCopy(locale).remove);
  },
);
it("passes the private live viewer into article discussion management", async () => {
  const html = renderToStaticMarkup(
    await ArticlePage({ params: Promise.resolve({ slug: "article" }) }),
  );
  expect(mocks.session).toHaveBeenCalledWith("session");
  expect(html).toContain(getDiscussionCopy("en").edit);
});
