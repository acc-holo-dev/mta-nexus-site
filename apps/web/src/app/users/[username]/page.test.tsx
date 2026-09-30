import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  exists: true,
  products: vi.fn(),
  servers: vi.fn(),
  directory: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  userRepository: {
    findByUsername: async () =>
      state.exists
        ? {
            id: "user",
            username: "member",
            displayName: "Member",
            role: "user",
            createdAt: new Date("2026-01-01"),
          }
        : null,
  },
  productRepository: { pagePublishedFreeByAuthor: state.products },
  serverRepository: { pageActivePublicByOwner: state.servers },
}));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../../../lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: state.directory },
  indexMtaObservations: () => () => undefined,
}));
vi.mock("../../../components/product-card", () => ({
  ProductCard: ({ product }: { product: { title: string } }) => <article>{product.title}</article>,
}));
vi.mock("../../../components/server-card", () => ({
  ServerCard: ({ server }: { server: { name: string } }) => <article>{server.name}</article>,
}));
vi.mock("@nexus/ui", () => ({
  Avatar: () => null,
  StatCard: ({ label, value }: { label: string; value: number }) => (
    <p>
      {label}: {value}
    </p>
  ),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
import Page from "./page";
const input = (page?: string | string[]) => ({
  params: Promise.resolve({ username: "member" }),
  searchParams: Promise.resolve({ page }),
});

beforeEach(() => {
  state.locale = "en";
  state.exists = true;
  state.products.mockReset();
  state.servers.mockReset();
  state.directory.mockReset();
  state.products.mockResolvedValue({
    products: [{ id: "resource", title: "Second-page resource" }],
    total: 49,
    page: 2,
    pageSize: 24,
    totalPages: 3,
  });
  state.servers.mockResolvedValue({ servers: [], total: 0, page: 1, pageSize: 12, totalPages: 1 });
});

it.each(["en", "ru"] as const)(
  "renders bounded resources, total and navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Page(input("2")));
    expect(state.products).toHaveBeenCalledWith("user", 2, 24);
    expect(html).toContain("49");
    expect(html).toContain("Second-page resource");
    expect(html).toContain('href="/users/member?page=1#resources"');
    expect(html).toContain('href="/users/member?page=3#resources"');
    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(state.directory).not.toHaveBeenCalled();
  },
);

it.each(["0", "-1", "abc", ["1", "2"], undefined])("normalizes malformed page %j", async (page) => {
  await Page(input(page));
  expect(state.products).toHaveBeenCalledWith("user", 1, 24);
});

it("keeps public servers visible when the external directory fails", async () => {
  state.servers.mockResolvedValue({
    servers: [{ id: "server", name: "Public server" }],
    total: 1,
    page: 1,
    pageSize: 12,
    totalPages: 1,
  });
  state.directory.mockRejectedValue(new Error("directory unavailable"));
  const html = renderToStaticMarkup(await Page(input("2")));
  expect(html).toContain("Public server");
  expect(html).toContain("Second-page resource");
});

it("does not query resources for an absent user", async () => {
  state.exists = false;
  await expect(Page(input())).rejects.toThrow("NOT_FOUND");
  expect(state.products).not.toHaveBeenCalled();
  expect(state.servers).not.toHaveBeenCalled();
});

it("omits the resource section for an empty portfolio", async () => {
  state.products.mockResolvedValue({
    products: [],
    total: 0,
    page: 1,
    pageSize: 24,
    totalPages: 1,
  });
  const html = renderToStaticMarkup(await Page(input()));
  expect(html).not.toContain('id="resources"');
  expect(html).not.toContain('rel="next"');
});

it("preserves resource and server pages independently", async () => {
  state.servers.mockResolvedValue({
    servers: [{ id: "server", name: "Second-page server" }],
    total: 25,
    page: 2,
    pageSize: 12,
    totalPages: 3,
  });
  state.directory.mockResolvedValue({ servers: [] });
  const html = renderToStaticMarkup(
    await Page({ ...input("2"), searchParams: Promise.resolve({ page: "2", serverPage: "2" }) }),
  );
  expect(state.servers).toHaveBeenCalledWith("user", 2, 12);
  expect(html).toContain('href="/users/member?page=3&amp;serverPage=2#resources"');
  expect(html).toContain('href="/users/member?page=2&amp;serverPage=3#servers"');
  expect(html).toContain("25");
  expect(html).toContain("Second-page server");
});
