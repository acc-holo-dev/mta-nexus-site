import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directory: vi.fn(),
  products: vi.fn(),
  articles: vi.fn(),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
      ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/ui", () => ({
  SectionHeader: ({ title, action }: { title: string; action?: React.ReactNode }) => (
    <header>
      <h2>{title}</h2>
      {action}
    </header>
  ),
  StatCard: ({ label, value }: { label: string; value: string | number }) => (
    <p>
      {label}: {value}
    </p>
  ),
}));

vi.mock("../apps/web/src/components/article-card", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) => <article>{article.title}</article>,
}));

vi.mock("../apps/web/src/components/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.directory,
  },
}));

vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: {
    listProducts: mocks.products,
  },
}));

vi.mock("../apps/web/src/lib/services/content-service", () => ({
  contentService: {
    listArticles: mocks.articles,
  },
}));

import HomePage from "../apps/web/src/app/page";

describe("bounded home feed reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.directory.mockResolvedValue({
      isStale: false,
      servers: [],
    });
    mocks.products.mockResolvedValue([]);
    mocks.articles.mockResolvedValue([]);
  });

  it("requests only bounded free/popular resources and four editorial updates", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(mocks.products).toHaveBeenCalledOnce();
    expect(mocks.products).toHaveBeenCalledWith({
      maxPrice: 0,
      sort: "popular",
      limit: 4,
    });
    expect(mocks.articles).toHaveBeenCalledOnce();
    expect(mocks.articles).toHaveBeenCalledWith(4);
    expect(mocks.directory).toHaveBeenCalledOnce();
    expect(html).toContain('href="/market?maxPrice=0"');
    expect(html).toContain('href="/articles"');
  });

  it("renders only the six bounded directory cards even if the snapshot is larger", async () => {
    mocks.directory.mockResolvedValue({
      isStale: false,
      servers: Array.from({ length: 10 }, (_, index) => ({
        address: `203.0.113.${index + 1}`,
        port: 22003,
        name: `Server ${index + 1}`,
        players: index,
        maxPlayers: 100,
      })),
    });

    const html = renderToStaticMarkup(await HomePage());

    expect((html.match(/mtasa:\/\//gu) ?? []).length).toBe(6);
    expect(html).toContain("Server 1");
    expect(html).toContain("Server 6");
    expect(html).not.toContain("Server 7");
  });
});
