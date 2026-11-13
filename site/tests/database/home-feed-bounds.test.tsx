import type * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  directory: vi.fn(),
  products: vi.fn(),
  articles: vi.fn(),
  listServers: vi.fn(),
  getSession: vi.fn(),
  loadPersonal: vi.fn(),
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
      ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("@nexus/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexus/ui")>();
  return {
    ...actual,
    SectionHeader: ({
      title,
      action,
      titleId,
    }: {
      title: string;
      action?: React.ReactNode;
      titleId?: string;
    }) => (
      <header>
        <h2 id={titleId}>{title}</h2>
        {action}
      </header>
    ),
  };
});

vi.mock("../../src/components/article-card", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) => <article>{article.title}</article>,
}));

vi.mock("../../src/components/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));

vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => "en"),
}));

vi.mock("../../src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: {
    getDirectory: mocks.directory,
  },
}));

vi.mock("../../src/lib/services/product-service", () => ({
  productService: {
    listProducts: mocks.products,
    getPublicAttributions: async () => new Map(),
  },
}));

vi.mock("../../src/lib/services/content-service", () => ({
  contentService: {
    listArticles: mocks.articles,
  },
}));

vi.mock("../../src/lib/services/server-service", () => ({
  serverService: { listServers: mocks.listServers },
}));

vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.getSession },
}));

vi.mock("../../src/lib/home-personal-changes", () => ({
  loadPersonalChangesSummary: mocks.loadPersonal,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

import HomePage from "../../src/app/page";
import { getDictionary } from "../../src/lib/i18n";

describe("bounded home feed reads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.directory.mockResolvedValue({
      isStale: false,
      servers: [],
    });
    mocks.products.mockResolvedValue([]);
    mocks.articles.mockResolvedValue([]);
    mocks.listServers.mockResolvedValue([]);
    mocks.getSession.mockResolvedValue(null);
    mocks.loadPersonal.mockResolvedValue({ status: "empty", items: [], failedSources: [] });
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
    expect(mocks.listServers).toHaveBeenCalledOnce();
    expect(mocks.listServers).toHaveBeenCalledWith(200);
    expect(mocks.getSession).toHaveBeenCalledOnce();
    expect(mocks.loadPersonal).not.toHaveBeenCalled();
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

  it("shows the bounded personal-changes honesty note for signed-in users", async () => {
    mocks.getSession.mockResolvedValue({ id: "actor" });
    mocks.loadPersonal.mockResolvedValue({ status: "empty", items: [], failedSources: [] });

    const html = renderToStaticMarkup(await HomePage());
    const copy = getDictionary("en").home;

    expect(mocks.loadPersonal).toHaveBeenCalledOnce();
    expect(html).toContain(copy.personalScopeNote);
    expect(html).toContain(copy.personalTitle);
    expect(html).toContain(copy.personalEmpty);
    expect(html).toContain(copy.personalEmptyHint);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-11");
  });

  it("clips the Home shell and recovers personal load failure with ErrorState retry", async () => {
    mocks.getSession.mockResolvedValue({ id: "actor" });
    mocks.loadPersonal.mockRejectedValue(new Error("personal-secret"));

    const html = renderToStaticMarkup(await HomePage());
    const copy = getDictionary("en").home;

    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.personalError);
    expect(html).toContain(copy.personalRetry);
    expect(html).toContain('href="/"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("personal-secret");
    expect(html).not.toContain(copy.personalEmpty);
  });

  it("names public home feed sections for assistive landmarks", async () => {
    const html = renderToStaticMarkup(await HomePage());

    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('aria-labelledby="home-network-heading"');
    expect(html).toContain('id="home-network-heading"');
    expect(html).toContain('aria-labelledby="home-free-resources-heading"');
    expect(html).toContain('id="home-free-resources-heading"');
    expect(html).toContain('aria-labelledby="home-community-updates-heading"');
    expect(html).toContain('id="home-community-updates-heading"');
  });
});
