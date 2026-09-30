import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  user: { id: "author", username: "creator", displayName: "Creator", bio: "Author bio", role: "developer", isVerified: false } as null | { id: string; username: string; displayName: string; bio: string; role: string; isVerified: boolean },
  products: vi.fn(),
}));
vi.mock("../../../lib/services/auth-service", () => ({ authService: { getUserByUsername: async () => state.user } }));
vi.mock("@nexus/db", () => ({ productRepository: { listPublishedFreeByAuthor: state.products } }));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../components/product-card", () => ({ ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article> }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NOT_FOUND"); } }));
vi.mock("@nexus/ui", () => ({
  Avatar: () => null,
  StatCard: ({ label, value }: { label: string; value: string | number }) => <p>{label}: {value}</p>,
  EmptyState: ({ title }: { title: string }) => <p>{title}</p>,
}));
import Page, { generateMetadata } from "./page";
const params = () => ({ params: Promise.resolve({ username: "creator" }) });

beforeEach(() => {
  state.locale = "en";
  state.user = { id: "author", username: "creator", displayName: "Creator", bio: "Author bio", role: "developer", isVerified: false };
  state.products.mockReset();
  state.products.mockResolvedValue([{ id: "outside-global-top-100", title: "Author's published resource" }]);
});

it.each(["en", "ru"] as const)("renders author-scoped resources with one h1 in %s", async (locale) => {
  state.locale = locale;
  const html = renderToStaticMarkup(await Page(params()));
  expect(state.products).toHaveBeenCalledWith("author");
  expect(html).toContain("published resource");
  expect(html.match(/<h1\b/g)).toHaveLength(1);
  expect(html).toContain("Creator");
});

it("uses the canonical developer URL and bounded profile description", async () => {
  if (!state.user) throw new Error("Missing test user");
  state.user.bio = "x".repeat(200);
  expect(await generateMetadata(params())).toMatchObject({ title: "Creator (@creator)", description: "x".repeat(155), alternates: { canonical: "/developers/creator" } });
});

it.each(["user", "moderator", "server_owner"])("does not expose a developer page for role %s", async (role) => {
  if (!state.user) throw new Error("Missing test user");
  state.user.role = role;
  await expect(Page(params())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled();
  expect(await generateMetadata(params())).toMatchObject({ robots: { index: false, follow: false } });
});

it("returns not found without resource queries for an absent profile", async () => {
  state.user = null;
  await expect(Page(params())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled();
});
