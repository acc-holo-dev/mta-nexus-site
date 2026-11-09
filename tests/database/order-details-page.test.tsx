import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  details: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/purchases",
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { getBuyerOrderDetails: state.details },
}));

import PurchaseDetailLoading from "../../apps/web/src/app/workspace/purchases/[id]/loading";
import Page from "../../apps/web/src/app/workspace/purchases/[id]/page";
import { getCommerceHistoryCopy } from "../../apps/web/src/lib/commerce-history-i18n";
import { getDictionary } from "../../apps/web/src/lib/i18n";

const input = {
  params: Promise.resolve({ id: "ord_a" }),
  searchParams: Promise.resolve({ page: "2" }),
};
beforeEach(() => {
  state.user = { id: "usr_a" };
  state.locale = "en";
  state.details.mockReset().mockResolvedValue({
    order: {
      id: "ord_a",
      orderNumber: "<script>NX-001</script>",
      status: "completed",
      totalAmount: 4500,
      currency: "USD",
      createdAt: new Date("2026-10-10"),
      privateToken: "PRIVATE-TOKEN",
    },
    items: [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "<script>Resource</script>",
        productSlug: "resource",
        unitPrice: 4500,
        currency: "USD",
        hasCurrentAccess: false,
        key: "PRIVATE-LICENSE-KEY",
      },
      {
        id: "itm_b",
        productId: "prd_b",
        productTitle: null,
        productSlug: null,
        unitPrice: 10,
        currency: "USD",
        hasCurrentAccess: false,
      },
    ],
    total: 21,
    page: 2,
    totalPages: 2,
  });
});
it("avoids private reads while signed out and hides unknown orders", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await Page(input))).toContain("/auth/login");
  expect(state.details).not.toHaveBeenCalled();
  state.user = { id: "usr_a" };
  state.details.mockResolvedValue(null);
  await expect(Page(input)).rejects.toThrow("NOT_FOUND");
});
it.each(["en", "ru"] as const)(
  "renders a localized receipt without secrets or implied grants in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Page(input));
    expect(state.details).toHaveBeenCalledWith(state.user, "ord_a", 2);
    expect(html).toContain("&lt;script&gt;NX-001&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;Resource&lt;/script&gt;");
    expect(html).not.toContain("PRIVATE-TOKEN");
    expect(html).not.toContain("PRIVATE-LICENSE-KEY");
    expect(html).toContain(
      locale === "ru" ? "Действующего доступа к скачиванию нет" : "No current download access",
    );
    expect(html).toContain('href="?page=1"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).not.toContain("/api/checkout");
  },
);
it("recovers with ErrorState when order details fail to load", async () => {
  state.details.mockRejectedValue(new Error("db unavailable"));
  const copy = getCommerceHistoryCopy("en");
  const html = renderToStaticMarkup(await Page(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.orderLoadUnavailable);
  expect(html).toContain(copy.orderLoadUnavailableHint);
  expect(html).toContain(getDictionary("en").errors.retry);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-h-11");
  expect(html).toContain('href="/workspace/purchases/ord_a?page=2"');
});
it("renders EmptyState when an order has no line items", async () => {
  state.details.mockResolvedValue({
    order: {
      id: "ord_a",
      orderNumber: "NX-001",
      status: "completed",
      totalAmount: 0,
      currency: "USD",
      createdAt: new Date("2026-10-10"),
    },
    items: [],
    total: 0,
    page: 1,
    totalPages: 1,
  });
  const copy = getCommerceHistoryCopy("en");
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "ord_a" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(copy.emptyItems);
  expect(html).toContain(copy.emptyItemsHint);
});
it("clips the honest purchase detail loading shell on narrow layouts", async () => {
  const html = renderToStaticMarkup(await PurchaseDetailLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(getCommerceHistoryCopy("en").loading);
});
