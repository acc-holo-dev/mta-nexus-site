import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru", exists: true, products: vi.fn(), content: vi.fn() }));
vi.mock("@nexus/db", () => ({
  organizationRepository: { findBySlug: async () => state.exists ? { id: "org", slug: "team", name: "Team" } : null },
  productRepository: { pagePublishedFreeByOrganization: state.products },
  contentRepository: { pagePublishedEditorialByOrganization: state.content },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../components/product-card", () => ({ ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article> }));
vi.mock("../../../components/article-card", () => ({ ArticleCard: ({ article }: { article: { title: string } }) => <article>{article.title}</article> }));
vi.mock("@nexus/ui", () => ({ StatCard: ({ value }: { value: number }) => <p>{value}</p> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import Page from "./page";
const input = (page?: string | string[], articlePage?: string | string[]) => ({ params: Promise.resolve({ slug: "team" }), searchParams: Promise.resolve({ page, articlePage }) });
beforeEach(() => {
  state.locale = "en"; state.exists = true; state.products.mockReset(); state.content.mockReset();
  state.products.mockResolvedValue({ products: [{ id: "release", title: "Later release" }], total: 120, page: 2, totalPages: 5 });
  state.content.mockResolvedValue({ items: [{ id: "article", type: "article", title: "Team article" }], total: 137, page: 3, totalPages: 12 });
});
it.each(["en", "ru"] as const)("renders a paginated portfolio and total in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await Page(input("2", "3")));
  expect(state.products).toHaveBeenCalledWith("org", 2, 24);
  expect(html).toContain("120"); expect(html).toContain("Later release");
  expect(html).toContain('href="/organizations/team?page=3&amp;articlePage=3#resources"');
  expect(html).toContain("Team article");
  expect(html).toContain("137");
  expect(state.content).toHaveBeenCalledWith("org", 3, 12);
  expect(html).toContain('href="/organizations/team?page=2&amp;articlePage=4#articles"');
  expect(html.match(/<h1\b/g)).toHaveLength(1);
});
it.each(["0", "bad", ["1", "2"]])("normalizes invalid page %j", async (page) => {
  await Page(input(page)); expect(state.products).toHaveBeenCalledWith("org", 1, 24);
});
it("does not query a missing organization portfolio", async () => {
  state.exists = false;
  await expect(Page(input())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled(); expect(state.content).not.toHaveBeenCalled();
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
