vi.mock("server-only", () => ({}));

import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  details: vi.fn(),
  walletEnabled: false,
  fxRates: vi.fn(
    async (): Promise<
      { baseCurrency: string; quoteCurrency: string; baseAmount: number; quoteAmount: number }[]
    > => [],
  ),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/purchases",
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/services/commerce/commerce-service", () => ({
  commerceService: { getBuyerOrderDetails: state.details },
}));
vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.walletEnabled,
  WalletPaymentService: class {
    listFxRates() {
      return state.fxRates();
    }
  },
}));

import PurchaseDetailLoading from "../../src/app/workspace/purchases/[id]/loading";
import Page from "../../src/app/workspace/purchases/[id]/page";
import { getCommerceHistoryCopy } from "../../src/features/commerce/commerce-history-i18n";
import { formatHistoryAmount } from "../../src/features/commerce/commerce-history-format";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";
import { getDictionary } from "../../src/lib/i18n";

const input = {
  params: Promise.resolve({ id: "ord_a" }),
  searchParams: Promise.resolve({ page: "2" }),
};
beforeEach(() => {
  state.user = { id: "usr_a" };
  state.locale = "en";
  state.walletEnabled = false;
  state.fxRates.mockReset().mockResolvedValue([]);
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
    walletSettled: false,
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
    expect(html).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
    expect(html).toMatch(/(?:min-h-11|link[A-Za-z]\w*|link-shell)/);
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
  expect(html).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(html).toMatch(/(?:min-h-11|link[A-Za-z]\w*|link-shell)/);
  expect(html).toContain('href="/workspace/purchases/ord_a?page=2"');
});
it("names completed site-wallet settle and purchased-build evidence on the receipt", async () => {
  state.details.mockResolvedValue({
    order: {
      id: "ord_a",
      orderNumber: "NX-001",
      status: "completed",
      totalAmount: 4500,
      currency: "USD",
      createdAt: new Date("2026-10-10"),
    },
    items: [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "Resource",
        productSlug: null,
        unitPrice: 4500,
        currency: "USD",
        hasCurrentAccess: true,
        purchasedBuildId: "bld_a",
        purchasedVersion: "1.2.0",
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
    walletSettled: true,
  });
  const copy = getCommerceHistoryCopy("en");
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "ord_a" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(copy.walletReceiptNote);
  expect(html).not.toContain(copy.receiptNote);
  expect(html).toContain(copy.purchasedBuildEvidence);
  expect(html).toContain("v1.2.0");
  expect(html).toContain("bld_a");
  expect(html).toContain('data-purchased-build-evidence=""');
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
    walletSettled: false,
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
it("states a failed recorded rate once per section and quotes each amount when rates exist", async () => {
  const walletCopy = getWalletCopy("en");
  const recordedTotal = formatHistoryAmount(4500, "USD", "en");
  const recordedLine = formatHistoryAmount(10, "USD", "en");
  const off = renderToStaticMarkup(await Page(input));
  expect(off).not.toContain(walletCopy.recordedRateUnavailable);
  expect(off).not.toContain("About ");
  expect(off).toContain(recordedTotal);
  expect(off).toContain(recordedLine);

  state.walletEnabled = true;
  state.fxRates.mockRejectedValue(new Error("fx unavailable"));
  const failed = renderToStaticMarkup(await Page(input));
  expect(failed.split(walletCopy.recordedRateUnavailable).length - 1).toBe(2);
  expect(failed).toContain(recordedTotal);
  expect(failed).toContain(recordedLine);

  state.details.mockResolvedValue({
    order: {
      id: "ord_a",
      orderNumber: "NX-001",
      status: "completed",
      totalAmount: 4000,
      listAmount: 4500,
      discountAmount: 500,
      promoCode: "SAVE",
      currency: "USD",
      createdAt: new Date("2026-10-10"),
    },
    items: [
      {
        id: "itm_a",
        productId: "prd_a",
        productTitle: "Resource",
        productSlug: "resource",
        unitPrice: 4500,
        currency: "USD",
        hasCurrentAccess: false,
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
    walletSettled: false,
  });
  state.fxRates.mockResolvedValue([
    { baseCurrency: "USD", quoteCurrency: "EUR", baseAmount: 100, quoteAmount: 90 },
  ]);
  const quoted = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "ord_a" }),
      searchParams: Promise.resolve({}),
    }),
  );
  expect(quoted).not.toContain(walletCopy.recordedRateUnavailable);
  expect(quoted.split("About ").length - 1).toBe(3);
  expect(quoted.split("The discount is about ").length - 1).toBe(1);
  expect(quoted).toContain(formatHistoryAmount(4000, "USD", "en"));
  expect(quoted).toContain(formatHistoryAmount(500, "USD", "en"));
  expect(quoted).toContain(formatHistoryAmount(4500, "USD", "en"));
});
it("clips the honest purchase detail loading shell on narrow layouts", async () => {
  const html = renderToStaticMarkup(await PurchaseDetailLoading());
  expect(html).toMatch(/(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(html).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(html).toContain(getCommerceHistoryCopy("en").loading);
});
