import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
const mocks = vi.hoisted(() => ({ actor: { id: "author" } as { id: string } | null, locale: "en" as "en" | "ru", list: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("../../../lib/services/auth-service", () => ({ authService: { getSession: async () => mocks.actor } }));
vi.mock("../../../lib/services/product-service", () => ({ productService: { listManagedProducts: mocks.list } }));
vi.mock("../../../lib/i18n-server", () => ({ getRequestLocale: async () => mocks.locale }));
import Page, { metadata } from "./page";
beforeEach(() => { mocks.actor = { id: "author" }; mocks.locale = "en"; mocks.list.mockReset().mockResolvedValue({ products: [{ id: "resource", title: "Owned resource", currentVersion: "1.0.0", status: "pending_review" }], page: 2, totalPages: 3 }); });
it.each(["en", "ru"] as const)("localizes the author list and preserves status during pagination in %s", async (locale) => {
  mocks.locale = locale;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ status: "pending_review", page: "2" }) }));
  expect(mocks.list).toHaveBeenCalledWith(mocks.actor, "pending_review", 2);
  expect(html).toContain("/workspace/resources/resource");
  expect(html).toContain("status=pending_review&amp;page=3");
  expect(html).toContain(locale === "ru" ? "Мои ресурсы" : "My resources");
  expect(metadata.robots).toMatchObject({ index: false });
});
it("does not query private resources when signed out", async () => {
  mocks.actor = null;
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(mocks.list).not.toHaveBeenCalled(); expect(html).toContain("/auth/login");
});
it("ignores invalid status filters", async () => {
  await Page({ searchParams: Promise.resolve({ status: "admin-only" }) });
  expect(mocks.list).toHaveBeenCalledWith(mocks.actor, undefined, 1);
});
