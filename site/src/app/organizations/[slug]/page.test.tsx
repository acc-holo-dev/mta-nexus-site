vi.mock("../../../components/follow-button", () => ({
  FollowButton: (props: { initial?: unknown }) => (
    <button type="button" data-follow-initial={JSON.stringify(props.initial ?? null)}>
      Follow
    </button>
  ),
}));

import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  exists: true,
  websiteUrl: "",
  description: "",
  slug: "team",
  products: vi.fn(),
  content: vi.fn(),
  session: vi.fn(async (): Promise<{ id: string; role: string } | null> => null),
  followStates: vi.fn(async (): Promise<string[]> => []),
  muteState: vi.fn(async () => ({ muted: false, mutedUntil: null as string | null })),
}));
vi.mock("@nexus/db", () => ({
  organizationRepository: {
    findBySlug: async () =>
      state.exists
        ? {
            id: "org",
            slug: state.slug,
            name: "Team",
            description: state.description,
            websiteUrl: state.websiteUrl,
          }
        : null,
  },
  productRepository: { pagePublishedFreeByOrganization: state.products },
  contentRepository: { pagePublishedEditorialByOrganization: state.content },
  followWorkspaceRepository: {
    states: state.followStates,
    muteState: state.muteState,
  },
}));
vi.mock("../../../lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
  getRequestCookieStore: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("../../../lib/services/product-service", () => ({
  productService: { getPublicAttributions: async () => new Map() },
}));
vi.mock("../../../lib/services/auth-service", () => ({
  authService: {
    getSession: () => state.session(),
  },
}));
vi.mock("../../../features/resources/view", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));
vi.mock("../../../components/article-card", () => ({
  ArticleCard: ({ article }: { article: { title: string } }) => <article>{article.title}</article>,
}));
vi.mock("@nexus/ui", () => ({
  StatCard: ({ value }: { value: number }) => <p>{value}</p>,
  EmptyState: ({
    title,
    description,
    action,
  }: {
    title: string;
    description: string;
    action?: ReactNode;
  }) => (
    <div>
      <p>{title}</p>
      <p>{description}</p>
      {action}
    </div>
  ),
  ErrorState: ({ title, action }: { title: string; action?: ReactNode }) => (
    <div role="alert">
      <h2>{title}</h2>
      {action}
    </div>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { getDictionary } from "../../../lib/i18n";
import Page, { generateMetadata } from "./page";

const input = (page?: string | string[], articlePage?: string | string[]) => ({
  params: Promise.resolve({ slug: "team" }),
  searchParams: Promise.resolve({ page, articlePage }),
});
beforeEach(() => {
  state.locale = "en";
  state.exists = true;
  state.websiteUrl = "";
  state.description = "";
  state.slug = "team";
  state.products.mockReset();
  state.content.mockReset();
  state.session.mockReset();
  state.followStates.mockReset();
  state.muteState.mockReset();
  state.session.mockResolvedValue(null);
  state.followStates.mockResolvedValue([]);
  state.muteState.mockResolvedValue({ muted: false, mutedUntil: null });
  state.products.mockResolvedValue({
    products: [{ id: "release", title: "Later release" }],
    total: 120,
    page: 2,
    totalPages: 5,
  });
  state.content.mockResolvedValue({
    items: [{ id: "article", type: "article", title: "Team article" }],
    total: 137,
    page: 3,
    totalPages: 12,
  });
});

it("SSR-hydrates guest organization follow controls without querying mute state", async () => {
  const html = renderToStaticMarkup(await Page(input()));
  expect(state.followStates).not.toHaveBeenCalled();
  expect(state.muteState).not.toHaveBeenCalled();
  expect(html).toContain(
    'data-follow-initial="{&quot;authenticated&quot;:false,&quot;actorId&quot;:null,&quot;following&quot;:false,&quot;muted&quot;:false,&quot;mutedUntil&quot;:null}"',
  );
});

it("SSR-hydrates authenticated organization follow and mute", async () => {
  state.session.mockResolvedValue({ id: "viewer", role: "user" });
  state.followStates.mockResolvedValue(["org"]);
  state.muteState.mockResolvedValue({
    muted: true,
    mutedUntil: "2026-12-01T00:00:00.000Z",
  });
  const html = renderToStaticMarkup(await Page(input()));
  expect(state.followStates).toHaveBeenCalledWith("viewer", "organization", ["org"]);
  expect(state.muteState).toHaveBeenCalledWith("viewer", "organization", "org");
  expect(html).toContain("&quot;authenticated&quot;:true");
  expect(html).toContain("&quot;following&quot;:true");
  expect(html).toContain("&quot;muted&quot;:true");
  expect(html).toContain("2026-12-01T00:00:00.000Z");
});
it.each(["en", "ru"] as const)("renders a paginated portfolio and total in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await Page(input("2", "3")));
  expect(state.products).toHaveBeenCalledWith("org", 2, 24);
  expect(html).toContain("120");
  expect(html).toContain("Later release");
  expect(html).toContain('href="/organizations/team?page=3&amp;articlePage=3#resources"');
  expect(html).toContain("Team article");
  expect(html).toContain("137");
  expect(state.content).toHaveBeenCalledWith("org", 3, 12);
  expect(html).toContain('href="/organizations/team?page=2&amp;articlePage=4#articles"');
  expect(html).toContain("min-w-0 space-y-10 overflow-x-clip");
  expect(html).toContain("min-h-11");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
});
it.each(["0", "bad", ["1", "2"]])("normalizes invalid page %j", async (page) => {
  await Page(input(page));
  expect(state.products).toHaveBeenCalledWith("org", 1, 24);
});
it("does not query a missing organization portfolio", async () => {
  state.exists = false;
  await expect(Page(input())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled();
  expect(state.content).not.toHaveBeenCalled();
});

it.each(["0", "bad", ["1", "2"]])("normalizes invalid article page %j", async (page) => {
  await Page(input("2", page));
  expect(state.content).toHaveBeenCalledWith("org", 1, 12);
  expect(state.products).toHaveBeenCalledWith("org", 2, 24);
});
it("omits empty article sections and navigation", async () => {
  state.content.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
  const html = renderToStaticMarkup(await Page(input()));
  expect(html).not.toContain('id="articles"');
  expect(html).not.toContain("articlePage=");
});

it.each(["en", "ru"] as const)(
  "shows organization load failures as alerts instead of an empty portfolio in %s",
  async (locale) => {
    state.locale = locale;
    const copy = getDictionary(locale).organizations;
    state.products.mockRejectedValueOnce(new Error("private-database-detail"));
    const html = renderToStaticMarkup(await Page(input("2", "3")));
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.loadUnavailable);
    expect(html).toContain('href="/organizations/team"');
    expect(html).toContain(getDictionary(locale).errors.retry);
    expect(html).toContain("min-h-11");
    expect(html).toContain("overflow-x-clip");
    expect(html).not.toContain("private-database-detail");
    expect(html).not.toContain("Later release");
    expect(html).not.toContain('id="resources"');
  },
);

it.each(["en", "ru"] as const)(
  "explains an empty organization portfolio without implying a load failure in %s",
  async (locale) => {
    state.locale = locale;
    const copy = getDictionary(locale).organizations;
    state.products.mockResolvedValue({ products: [], total: 0, page: 1, totalPages: 1 });
    state.content.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
    const html = renderToStaticMarkup(await Page(input()));
    expect(html).toContain(copy.emptyPortfolio);
    expect(html).toContain(copy.emptyPortfolioHint);
    expect(html).toContain('href="/market?maxPrice=0"');
    expect(html).toContain("min-h-11");
    expect(html).not.toContain('id="resources"');
    expect(html).not.toContain('id="articles"');
    expect(html).not.toContain('role="alert"');
  },
);

it("uses stored organization identity and bounds its description", async () => {
  state.description = `  ${"x".repeat(200)}  `;
  state.slug = "team/name";
  expect(await generateMetadata(input())).toEqual({
    title: "Team",
    description: "x".repeat(155),
    alternates: { canonical: "/organizations/team%2Fname" },
  });
  expect(state.products).not.toHaveBeenCalled();
  expect(state.content).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "localizes empty descriptions and missing metadata in %s",
  async (locale) => {
    state.locale = locale;
    state.description = "   ";
    expect(await generateMetadata(input())).toMatchObject({
      description: getDictionary(locale).organizations.fallback,
    });
    state.exists = false;
    expect(await generateMetadata(input())).toEqual({
      title: getDictionary(locale).errors.notFoundTitle,
      robots: { index: false, follow: false },
    });
  },
);

it.each(["javascript:alert(1)", "data:text/html,unsafe", "https://user:password@example.com"])(
  "hides unsafe stored website %s",
  async (websiteUrl) => {
    state.websiteUrl = websiteUrl;
    const html = renderToStaticMarkup(await Page(input()));
    expect(html).not.toContain(websiteUrl);
    expect(html).not.toContain('target="_blank"');
  },
);
it("renders a safe stored website", async () => {
  state.websiteUrl = "https://example.com/team";
  expect(renderToStaticMarkup(await Page(input()))).toContain('href="https://example.com/team"');
});
