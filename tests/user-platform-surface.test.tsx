import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import type { Locale } from "../apps/web/src/lib/i18n";
import { getUserPlatformCopy } from "../apps/web/src/lib/user-platform-copy";
const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  items: [] as Record<string, unknown>[],
  failed: false,
}));
const mocks = vi.hoisted(() => ({ articles: vi.fn(), community: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: { pageArticles: mocks.articles, pageCommunity: mocks.community },
}));
import ArticlesPage from "../apps/web/src/app/articles/page";
import CommunityPage from "../apps/web/src/app/community/page";
import { AuthorContentForm } from "../apps/web/src/components/author-content-form";
import { ContentPageNavigation } from "../apps/web/src/components/content-catalog-controls";
beforeEach(() => {
  vi.clearAllMocks();
  state.items = [];
  state.failed = false;
  for (const mock of [mocks.articles, mocks.community])
    mock.mockImplementation(async () => {
      if (state.failed) throw new Error("DB private details");
      return { items: state.items, page: 2, hasMore: true };
    });
});
it.each(["ru", "en"] as Locale[])("renders new and archived publication forms in %s", (locale) => {
  const copy = getUserPlatformCopy(locale);
  const create = renderToStaticMarkup(<AuthorContentForm locale={locale} />);
  expect(create).toContain('name="slug"');
  expect(create).toContain('name="body"');
  expect(create).not.toContain('name="status"');
  expect(create).toContain(copy.reviewNote);
  const archived = renderToStaticMarkup(
    <AuthorContentForm
      locale={locale}
      initial={{
        id: "cnt_1",
        title: "Archived title",
        slug: "archived-title",
        type: "article",
        status: "archived",
        body: "A complete archived article.",
        excerpt: "",
        coverImageUrl: "",
        tags: [],
        updatedAt: "2026-10-10T12:00:00Z",
      }}
    />,
  );
  expect(archived).toContain("<fieldset disabled");
  expect(archived).toContain(copy.archivedNote);
  expect(archived).toContain('href="/support"');
  expect(archived).not.toContain('href="/articles/archived-title"');
});
it.each(["ru", "en"] as Locale[])(
  "filters and pages public articles and community in %s",
  async (locale) => {
    state.locale = locale;
    const query = Promise.resolve({ q: "lua", type: "article", status: "draft", page: "2" });
    const html = renderToStaticMarkup(await ArticlesPage({ searchParams: query }));
    expect(mocks.articles).toHaveBeenCalledWith({ page: 2, query: "lua", type: "article" });
    expect(html).toContain('action="/articles"');
    expect(html).toContain('href="/workspace/content/new"');
    expect(html).toContain('rel="next"');
    expect(html).toContain("q=lua&amp;type=article&amp;page=3");
    const community = renderToStaticMarkup(
      await CommunityPage({ searchParams: Promise.resolve({ q: "help", type: "question" }) }),
    );
    expect(mocks.community).toHaveBeenCalledWith({ page: 1, query: "help", type: "question" });
    expect(community).toContain('action="/community"');
    expect(community).toContain('href="/workspace/content"');
  },
);
it("renders service failure separately from an empty feed and hides internal text", async () => {
  state.locale = "en";
  state.failed = true;
  const html = renderToStaticMarkup(await ArticlesPage());
  expect(html).toContain('role="alert"');
  expect(html).toContain(getUserPlatformCopy("en").unavailable);
  expect(html).not.toContain("DB private details");
});
it("preserves authored status/search/type filters in the paginator", () => {
  const html = renderToStaticMarkup(
    <ContentPageNavigation
      path="/workspace/content"
      locale="ru"
      page={3}
      hasMore
      filters={{ page: 3, query: "Lua & MTA", type: "news", status: "draft" }}
    />,
  );
  expect(html).toContain("status=draft");
  expect(html).toContain("type=news");
  expect(html).toContain("page=2");
  expect(html).toContain("page=4");
  expect(html).toContain("q=Lua+%26+MTA");
});
