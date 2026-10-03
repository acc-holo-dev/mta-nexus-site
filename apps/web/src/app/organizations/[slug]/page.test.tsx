import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ locale: "en" as "en" | "ru", exists: true, products: vi.fn(), content: vi.fn() }));
vi.mock("@nexus/db", () => ({
  organizationRepository: { findBySlug: async () => state.exists ? { id: "org", slug: "team", name: "Team" } : null },
  productRepository: { pagePublishedFreeByOrganization: state.products },
  contentRepository: { listPublishedByOrganization: state.content },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../components/product-card", () => ({ ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article> }));
vi.mock("../../../components/article-card", () => ({ ArticleCard: ({ article }: { article: { title: string } }) => <article>{article.title}</article> }));
vi.mock("@nexus/ui", () => ({ StatCard: ({ value }: { value: number }) => <p>{value}</p> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
import Page from "./page";
const input = (page?: string | string[]) => ({ params: Promise.resolve({ slug: "team" }), searchParams: Promise.resolve({ page }) });
beforeEach(() => {
  state.locale = "en"; state.exists = true; state.products.mockReset(); state.content.mockReset();
  state.products.mockResolvedValue({ products: [{ id: "release", title: "Later release" }], total: 120, page: 2, totalPages: 5 });
  state.content.mockResolvedValue([{ id: "article", type: "article", title: "Team article" }]);
});
it.each(["en", "ru"] as const)("renders a paginated portfolio and total in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await Page(input("2")));
  expect(state.products).toHaveBeenCalledWith("org", 2, 24);
  expect(html).toContain("120"); expect(html).toContain("Later release");
  expect(html).toContain('href="/organizations/team?page=3#resources"');
  expect(html).toContain("Team article");
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
