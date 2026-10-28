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
  productService: { listPublicPage: mocks.listPublicPage },
}));
vi.mock("../../components/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

import MarketPage from "./page";

describe("free resource catalog as rendered for visitors", () => {
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
    expect(html).toContain("Previous");
    expect(html).toContain("type=api");
    expect(html).toContain("q=maps");
    expect(html).toContain("page=2");
  });
});
