import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary, type Locale } from "../../apps/web/src/lib/i18n";
import { getUserPlatformCopy } from "../../apps/web/src/lib/user-platform-copy";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  items: [] as Record<string, unknown>[],
  failed: false,
}));
const mocks = vi.hoisted(() => ({ articles: vi.fn(), community: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/workspace/content",
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../apps/web/src/lib/services/content-service", () => ({
  contentService: { pageArticles: mocks.articles, pageCommunity: mocks.community },
}));

import ArticlesPage from "../../apps/web/src/app/articles/page";
import CommunityPage from "../../apps/web/src/app/community/page";
import { AuthorContentForm } from "../../apps/web/src/components/author-content-form";
import { ContentPageNavigation } from "../../apps/web/src/components/content-catalog-controls";
import { PlatformSignIn } from "../../apps/web/src/components/platform-sign-in";

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
  expect(create).toContain("rounded-lg");
  expect(create).toContain(copy.preview);
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
  expect(archived).toContain("draft=publication");
  expect(archived).toContain("subject=Archived+title");
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
  const html = renderToStaticMarkup(await ArticlesPage({}));
  expect(html).toContain('role="alert"');
  expect(html).toContain(getUserPlatformCopy("en").unavailable);
  expect(html).not.toContain("DB private details");
  const community = renderToStaticMarkup(
    await CommunityPage({ searchParams: Promise.resolve({ q: "help" }) }),
  );
  expect(community).toContain('role="alert"');
  expect(community).toContain(getUserPlatformCopy("en").unavailable);
  expect(community).toContain("Try again");
  expect(community).toContain('href="/community?q=help"');
  expect(community).toContain("overflow-x-clip");
  expect(community).not.toContain("DB private details");
  expect(community).not.toContain(getDictionary("en").community.noTopics);
});
it("adds login next from pathname when PlatformSignIn has no returnPath", () => {
  const html = renderToStaticMarkup(<PlatformSignIn locale="en" />);
  const copy = getDictionary("en").workspace;
  expect(html).toContain("/auth/login?next=%2Fworkspace%2Fcontent");
  expect(html).toContain("/auth/register?next=%2Fworkspace%2Fcontent");
  expect(html).toContain(copy.signInMessage);
  expect(html).toContain(copy.createAccount);
  expect(html).toContain("min-h-11");
  expect(html).toContain("focus-visible:outline-[var(--nexus-accent)]");
});

it("prefers explicit returnPath over pathname for PlatformSignIn login href", () => {
  const html = renderToStaticMarkup(<PlatformSignIn locale="en" returnPath="/settings/history" />);
  expect(html).toContain("/auth/login?next=%2Fsettings%2Fhistory");
  expect(html).toContain("/auth/register?next=%2Fsettings%2Fhistory");
  expect(html).not.toContain("%2Fworkspace%2Fcontent");
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
