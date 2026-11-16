vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  listPublicPage: vi.fn(),
}));

vi.mock("../../lib/i18n-server", () => ({
  getRequestLocale: async () => mocks.locale,
}));
vi.mock("../../lib/services/product-service", () => ({
  productService: {
    listPublicPage: mocks.listPublicPage,
    getPublicAttributions: async () => new Map(),
  },
}));
vi.mock("../../features/resources/view", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

import MarketLoading from "./loading";
import MarketPage from "./page";

describe("free resource catalog as rendered for visitors", () => {
  it("renders an honest loading shell with localized title and status", async () => {
    mocks.locale = "en";
    const html = renderToStaticMarkup(await MarketLoading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("Free Resource Library");
    expect(html).toContain("Loading resources");
  });

  it("renders Russian search and a next link that keeps filters and the search term", async () => {
    mocks.locale = "ru";
    mocks.listPublicPage.mockResolvedValueOnce({
      products: [{ id: "p1", title: "Скрипт" }],
      hasMore: true,
    });
    const html = renderToStaticMarkup(
      await MarketPage({
        searchParams: Promise.resolve({ type: "script", sort: "rating", q: "MTA & RPG" }),
      }),
    );

    expect(mocks.listPublicPage).toHaveBeenCalledWith({
      type: "script",
      sort: "rating",
      query: "MTA & RPG",
      page: 1,
      pageSize: 24,
    });
    expect(html).toMatch(/<search\b[^>]*aria-label="Поиск ресурсов"/);
    expect(html).toContain("Искать бесплатные ресурсы MTA");
    expect(html).toContain("Скрипт");
    expect(html).toContain("page=2");
    expect(html).toContain("q=MTA+%26+RPG");
    expect(html).toContain("Далее");
  });

  it("explains an exhausted page and offers a way back to the same filtered first page", async () => {
    mocks.locale = "en";
    mocks.listPublicPage.mockResolvedValueOnce({ products: [], hasMore: false });
    const html = renderToStaticMarkup(
      await MarketPage({
        searchParams: Promise.resolve({ type: "api", sort: "newest", page: "3", q: " maps " }),
      }),
    );

    expect(html).toContain("There are no resources on this page.");
    expect(html).toContain("beyond the available results");
    expect(html).toContain("Previous");
    expect(html).toContain("type=api");
    expect(html).toContain("q=maps");
    expect(html).toContain("page=2");
    expect(html).toContain("Back to page 1 with the same filters");
    expect(html).toContain("Clear search only");
    expect(html).toContain("Show all categories");
    expect(html).toContain("min-h-11");
    expect(html).toContain("overflow-x-clip");
  });

  it("explains zero results with active filters without wiping every parameter on partial reset", async () => {
    mocks.locale = "en";
    mocks.listPublicPage.mockResolvedValueOnce({ products: [], hasMore: false });
    const html = renderToStaticMarkup(
      await MarketPage({
        searchParams: Promise.resolve({ type: "script", sort: "rating", q: "missing" }),
      }),
    );
    expect(html).toContain("Nothing matches the active Market filters");
    expect(html).toContain("not a catalog outage");
    expect(html).toContain("Active filters");
    expect(html).toContain("Resource categories: Scripts");
    expect(html).toContain("Sort resources: Top Rated");
    expect(html).toContain("Search resources: missing");
    expect(html).toContain('href="/market?type=script&amp;sort=rating"');
    expect(html).toContain('href="/market?type=all&amp;sort=rating&amp;q=missing"');
  });

  it("shows ErrorState recovery when the catalog read fails", async () => {
    mocks.locale = "en";
    mocks.listPublicPage.mockRejectedValueOnce(new Error("database-secret"));
    const html = renderToStaticMarkup(
      await MarketPage({
        searchParams: Promise.resolve({ type: "script", sort: "rating", q: "maps", page: "2" }),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain("temporarily unavailable");
    expect(html).toContain("does not mean there are no resources");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/market?type=script&amp;sort=rating&amp;q=maps&amp;page=2"');
    expect(html).not.toContain("database-secret");
  });

  it("clips the catalog loading shell on narrow layouts", async () => {
    mocks.locale = "en";
    const html = renderToStaticMarkup(await MarketLoading());
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-clip");
  });
});
