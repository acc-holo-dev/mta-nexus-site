import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { PublicationFeed } from "../../site/src/components/publication-feed";
import {
  type PublicationPage,
  publicationPageQuery,
} from "../../site/src/lib/publication-feed-contract";
import { publicationCopy } from "../../site/src/lib/publication-feed-copy";

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  session: vi.fn(),
  locale: "en" as "ru" | "en",
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../site/src/lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../site/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../../site/src/lib/services/publication-feed-service", () => ({
  publicationFeedService: { page: mocks.page },
}));

import Loading from "../../site/src/app/workspace/feed/loading";
import FollowingPage, { generateMetadata } from "../../site/src/app/workspace/feed/page";

const initial: PublicationPage = {
  items: [
    {
      id: "content",
      slug: "article",
      title: "Title",
      type: "news",
      excerpt: "Excerpt",
      image: null,
      commentCount: 0,
      publishedAt: "2026-10-10T12:00:00.000Z",
      author: { username: "writer", name: "Writer", avatar: null },
      organization: null,
      server: null,
      product: null,
      tags: [],
    },
  ],
  hasMore: false,
  nextCursor: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.locale = "en";
  mocks.page.mockResolvedValue(initial);
  mocks.session.mockResolvedValue({ id: "author", role: "user" });
});

it.each(["en", "ru"] as const)(
  "clips the authenticated following-feed shell and keeps EmptyState copy distinct in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = publicationCopy(locale);
    const html = renderToStaticMarkup(await FollowingPage({}));
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-11");
    expect(html).toContain(copy.title);
    expect(copy.emptyFollowing).not.toBe(copy.emptyFollowingHint);
    expect(copy.emptyFiltered).not.toBe(copy.emptyFilteredHint);
    expect(copy.loadUnavailable).not.toBe(copy.error);
    expect((await generateMetadata()).robots).toMatchObject({ index: false, follow: false });
  },
);

it.each(["en", "ru"] as const)(
  "shows ErrorState recovery when the following-feed session read fails in %s",
  async (locale) => {
    mocks.locale = locale;
    mocks.session.mockRejectedValue(new Error("session-secret"));
    const copy = publicationCopy(locale);
    const html = renderToStaticMarkup(
      await FollowingPage({
        searchParams: Promise.resolve({ source: "server", q: "MTA" }),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.error);
    expect(html).toContain(copy.retry);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/workspace/feed?source=server&amp;q=MTA"');
    expect(html).not.toContain("session-secret");
    expect(html).not.toContain(copy.emptyFollowing);
    expect(html).not.toContain(copy.loadUnavailable);
  },
);

it.each(["en", "ru"] as const)(
  "keeps loadUnavailable distinct from generic error on feed load failure in %s",
  (locale) => {
    const copy = publicationCopy(locale);
    const props = {
      filters: publicationPageQuery(),
      locale,
      path: "/workspace/feed",
      following: true as const,
    };
    const unavailable = renderToStaticMarkup(
      <PublicationFeed {...props} initial={null} errorCode="INTERNAL_ERROR" />,
    );
    expect(unavailable).toContain('role="alert"');
    expect(unavailable).toContain(copy.loadUnavailable);
    expect(unavailable).toContain(copy.retry);
    expect(unavailable).toContain("overflow-x-clip");
    expect(unavailable).toContain("min-h-11");
    expect(unavailable).not.toContain(copy.emptyFollowing);
    expect(unavailable).not.toContain(copy.error);

    const generic = renderToStaticMarkup(<PublicationFeed {...props} initial={null} />);
    expect(generic).toContain(copy.error);
    expect(generic).not.toContain(copy.loadUnavailable);
  },
);

it.each(["en", "ru"] as const)(
  "renders EmptyState title and description for an empty following feed in %s",
  (locale) => {
    const copy = publicationCopy(locale);
    const html = renderToStaticMarkup(
      <PublicationFeed
        initial={{ items: [], hasMore: false, nextCursor: null }}
        filters={publicationPageQuery()}
        locale={locale}
        path="/workspace/feed"
        following
      />,
    );
    expect(html).toContain(copy.emptyFollowing);
    expect(html).toContain(copy.emptyFollowingHint);
    expect(html).toContain(copy.discover);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/discover"');
  },
);

it.each(["en", "ru"] as const)(
  "renders EmptyState title and description for filtered empty feed results in %s",
  (locale) => {
    const copy = publicationCopy(locale);
    const html = renderToStaticMarkup(
      <PublicationFeed
        initial={{ items: [], hasMore: false, nextCursor: null }}
        filters={publicationPageQuery({ type: "post" })}
        locale={locale}
        path="/workspace/feed"
        following
      />,
    );
    expect(html).toContain(copy.emptyFiltered);
    expect(html).toContain(copy.emptyFilteredHint);
    expect(html).toContain(copy.reset);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain(copy.emptyFollowing);
    expect(html).not.toContain('href="/discover"');
  },
);

it.each(["en", "ru"] as const)(
  "renders an honest following-feed loading shell with clipped bounds in %s",
  async (locale) => {
    mocks.locale = locale;
    const copy = publicationCopy(locale);
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('id="publication-feed-loading-heading"');
    expect(html).toContain(`>${copy.title}<`);
    expect(html).toContain(copy.loading);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
  },
);
