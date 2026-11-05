import type { Content } from "@nexus/domain";
import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import {
  discoveryFollowSurfaceMocks,
  setupDiscoveryFollowSurface,
} from "./helpers/discovery-follow-surface-harness";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ usePathname: () => "/discover" }));
vi.mock("@nexus/db", async () => {
  const { discoveryFollowSurfaceMocks: mocks } = await import(
    "./helpers/discovery-follow-surface-harness"
  );
  return { followWorkspaceRepository: { states: mocks.states } };
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { discoveryFollowSurfaceMocks: mocks } = await import(
    "./helpers/discovery-follow-surface-harness"
  );
  return { authService: { getSession: mocks.viewer } };
});
vi.mock("../apps/web/src/lib/services/discovery-service", async () => {
  const { discoveryFollowSurfaceMocks: mocks } = await import(
    "./helpers/discovery-follow-surface-harness"
  );
  return { discoveryService: { page: mocks.page } };
});
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", async () => {
  const { discoveryFollowSurfaceMocks: mocks } = await import(
    "./helpers/discovery-follow-surface-harness"
  );
  return {
    mtaMasterDirectoryService: { getDirectory: mocks.directory },
    indexMtaObservations: () => () => null,
  };
});
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { getPublicAttributions: async () => new Map() },
}));
vi.mock("../apps/web/src/components/product-card", () => ({ ProductCard: () => null }));
vi.mock("../apps/web/src/components/server-card", () => ({ ServerCard: () => null }));
vi.mock("../apps/web/src/components/article-card", () => ({ ArticleCard: () => null }));

import { DirectoryFilters, DirectoryResults } from "../apps/web/src/components/discovery-directory";
import { LocaleProvider } from "../apps/web/src/components/locale-context";
import { parseDiscoverQuery } from "../apps/web/src/lib/discover-query";
import { discoveryCopy } from "../apps/web/src/lib/discovery-copy";
import { followActionCopy, followCopy } from "../apps/web/src/lib/follow-workspace-copy";

setupDiscoveryFollowSurface();

it.each(["en", "ru"] as const)(
  "renders accessible server filters and preserves them in page links in %s",
  async (locale) => {
    const state = parseDiscoverQuery({
      type: "servers",
      q: "RP",
      verified: "1",
      language: "ru",
      page: "2",
      sort: "name",
    });
    const filters = renderToStaticMarkup(<DirectoryFilters state={state} locale={locale} />);
    expect(filters).toContain('action="/discover"');
    expect(filters).toContain('name="language"');
    expect(filters).toContain('name="verified"');
    expect(filters).toContain("flex min-h-11 items-center gap-2");
    expect(filters).not.toContain("min-h-8");
    expect(filters).toContain(discoveryCopy(locale).filter);
    expect(filters).toContain("rounded-lg");
    expect(filters).toContain("bg-accent");
    discoveryFollowSurfaceMocks.page.mockResolvedValue({
      type: "servers",
      items: [],
      page: 2,
      hasMore: true,
    });
    const results = renderToStaticMarkup(await DirectoryResults({ state, locale }));
    expect(results).toContain("page=3");
    expect(results).toContain("language=ru");
    expect(results).toContain("verified=1");
    expect(results).toContain(discoveryCopy(locale).previous);
    expect(discoveryFollowSurfaceMocks.directory).not.toHaveBeenCalled();
  },
);
it("shows a directory read failure as an alert instead of an empty result", async () => {
  discoveryFollowSurfaceMocks.page.mockRejectedValue(new Error("private-database-detail"));
  const html = renderToStaticMarkup(
    await DirectoryResults({ state: parseDiscoverQuery({ type: "organizations" }), locale: "ru" }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(discoveryCopy("ru").unavailable);
  expect(html).not.toContain(discoveryCopy("ru").empty);
  expect(html).not.toContain("private-database-detail");
});
it("shows rate-limit failures separately from empty directory results", async () => {
  discoveryFollowSurfaceMocks.page.mockRejectedValue(
    new AppError("Too many searches", 429, "RATE_LIMIT_EXCEEDED"),
  );
  const html = renderToStaticMarkup(
    await DirectoryResults({
      state: parseDiscoverQuery({ type: "servers", q: "RP" }),
      locale: "en",
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(discoveryCopy("en").rate);
  expect(html).not.toContain(discoveryCopy("en").empty);
  expect(html).not.toContain(discoveryCopy("en").unavailable);
});
it("renders creator identity without exposing private account fields or interpreting HTML", async () => {
  discoveryFollowSurfaceMocks.page.mockResolvedValue({
    type: "creators",
    items: [
      {
        id: "user",
        username: "builder",
        displayName: "<script>alert(1)</script>",
        bio: "Public biography",
        avatarUrl: null,
        isVerified: false,
      },
    ],
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(html).toContain('href="/developers/builder"');
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
});
it("reads all grid follow states once and renders each authoritative initial state", async () => {
  discoveryFollowSurfaceMocks.viewer.mockResolvedValue({ id: "actor" });
  discoveryFollowSurfaceMocks.states.mockResolvedValue(["first"]);
  discoveryFollowSurfaceMocks.page.mockResolvedValue({
    type: "creators",
    items: ["first", "second"].map((id) => ({
      id,
      username: id,
      displayName: id,
      bio: "",
      avatarUrl: null,
      isVerified: false,
    })),
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(discoveryFollowSurfaceMocks.states).toHaveBeenCalledExactlyOnceWith("actor", "user", [
    "first",
    "second",
  ]);
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('aria-pressed="false"');
  expect(html).not.toContain("Checking…");
});
it("keeps catalog results visible and follow controls retryable after a state read failure", async () => {
  discoveryFollowSurfaceMocks.viewer.mockResolvedValue({ id: "actor" });
  discoveryFollowSurfaceMocks.states.mockRejectedValue(new Error("private-failure"));
  discoveryFollowSurfaceMocks.page.mockResolvedValue({
    type: "creators",
    items: [
      {
        id: "first",
        username: "first",
        displayName: "Visible creator",
        bio: "",
        avatarUrl: null,
        isVerified: false,
      },
    ],
    page: 1,
    hasMore: false,
  });
  const html = renderToStaticMarkup(
    <LocaleProvider locale="en">
      {await DirectoryResults({ state: parseDiscoverQuery({ type: "creators" }), locale: "en" })}
    </LocaleProvider>,
  );
  expect(html).toContain("Visible creator");
  expect(html).toContain(followCopy("en").retry);
  expect(html).toContain('role="alert"');
  expect(html).not.toContain('aria-pressed="false"');
  expect(html).not.toContain(`>${followActionCopy("en", "user").follow}<`);
  expect(html).not.toContain("private-failure");
});
it.each([
  ["news", "en", "News"],
  ["news", "ru", "Новость"],
  ["update", "en", "Update"],
  ["update", "ru", "Обновление"],
] as const)("localizes %s cards in %s", async (type, locale, label) => {
  const { ArticleCard } = await vi.importActual<
    typeof import("../apps/web/src/components/article-card")
  >("../apps/web/src/components/article-card");
  const article: Content = {
    id: "content",
    slug: "entry",
    title: "Entry",
    body: "Text",
    type,
    authorId: "author",
    status: "published",
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    tags: [],
    coverImageUrl: "https://safe.test/cover.png",
    createdAt: new Date("2026-10-10T12:00:00.000Z"),
    updatedAt: new Date("2026-10-10T12:00:00.000Z"),
  };
  const html = renderToStaticMarkup(<ArticleCard article={article} locale={locale} />);
  expect(html).toContain(`>${label}</div>`);
  expect(html).not.toContain(`>${type}</div>`);
});
