import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_current", role: "user" } as { id: string; role: "user" } | null,
  locale: "en" as "en" | "ru",
  buyer: vi.fn(),
  licenses: vi.fn(),
  seller: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/purchases",
}));
vi.mock("@nexus/db", () => ({
  orderRepository: {
    pageBuyerHistory: state.buyer,
    pageSellerHistory: state.seller,
  },
  licenseRepository: { pageUserHistory: state.licenses },
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...rest
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...rest }, children),
  };
});

import LicensesLoading from "../../src/app/workspace/licenses/loading";
import Licenses, { metadata as licensesMeta } from "../../src/app/workspace/licenses/page";
import PurchasesLoading from "../../src/app/workspace/purchases/loading";
import Purchases, { metadata as purchasesMeta } from "../../src/app/workspace/purchases/page";
import Sales, { metadata as salesMeta } from "../../src/app/workspace/sales/page";
import { getCommerceHistoryCopy } from "../../src/lib/commerce-history-i18n";
import { getDictionary } from "../../src/lib/i18n";
import { getLicenseMaintenanceCopy } from "../../src/lib/license-maintenance-i18n";

const date = new Date("2026-10-09T10:00:00.000Z");
const input = (page = "2") => ({ searchParams: Promise.resolve({ page }) });

describe("private legacy commerce pages", () => {
  beforeEach(() => {
    state.user = { id: "usr_current", role: "user" };
    state.locale = "en";
    state.buyer.mockReset().mockResolvedValue({
      orders: [
        {
          id: "ord_1",
          orderNumber: "<script>order</script>",
          status: "completed",
          totalAmount: 12345,
          currency: "USD",
          createdAt: date,
          buyerId: "usr_current",
        },
      ],
      total: 21,
      page: 2,
      totalPages: 2,
      pageSize: 20,
    });
    state.licenses.mockReset().mockResolvedValue({
      licenses: [
        {
          id: "lic_1",
          productTitle: "<script>licensed</script>",
          key: "PRIVATE-LICENSE-KEY-NEVER-RENDER",
          userId: "usr_current",
          serverId: "PRIVATE-SERVER-ID",
          model: "single_server",
          status: "active",
          expiresAt: new Date("2020-01-01T00:00:00Z"),
          createdAt: date,
          serverBound: true,
        },
      ],
      total: 21,
      page: 2,
      totalPages: 2,
      pageSize: 20,
    });
    state.seller.mockReset().mockResolvedValue({
      sales: [
        {
          id: "itm_1",
          productTitle: "<script>sold</script>",
          orderNumber: "ORD-001",
          unitPrice: 4500,
          currency: "USD",
          createdAt: date,
          buyerId: "PRIVATE-BUYER",
          buyerEmail: "private@example.test",
        },
      ],
      total: 21,
      page: 2,
      totalPages: 2,
      pageSize: 20,
    });
  });

  it("does not query buyer, license or seller history while signed out", async () => {
    state.user = null;
    for (const Component of [Purchases, Licenses, Sales]) {
      const html = renderToStaticMarkup(await Component(input()));
      expect(html).toMatch(/href="\/auth\/login\?next=%2Fworkspace%2F(purchases|licenses|sales)/);
    }
    expect(state.buyer).not.toHaveBeenCalled();
    expect(state.licenses).not.toHaveBeenCalled();
    expect(state.seller).not.toHaveBeenCalled();
  });

  it("preserves license archive filters in guest return paths", async () => {
    state.user = null;
    const html = renderToStaticMarkup(
      await Licenses({
        searchParams: Promise.resolve({
          q: "100%_",
          status: "expiring",
          binding: "bound",
          term: "finite",
          sort: "expires_soon",
          page: "2",
        }),
      }),
    );
    expect(html).toContain("q%3D100%2525_");
    expect(html).toContain("status%3Dexpiring");
    expect(html).toContain("binding%3Dbound");
    expect(html).toContain("term%3Dfinite");
    expect(html).toContain("sort%3Dexpires_soon");
    expect(html).toContain("page%3D2");
    expect(html).toContain("/auth/login?next=%2Fworkspace%2Flicenses%3F");
    expect(html).toContain("/auth/register?next=%2Fworkspace%2Flicenses%3F");
    expect(state.licenses).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)(
    "localizes purchases and escapes order IDs in %s",
    async (locale) => {
      state.locale = locale;
      const html = renderToStaticMarkup(await Purchases(input()));
      expect(state.buyer).toHaveBeenCalledWith("usr_current", 2);
      expect(html).toContain("&lt;script&gt;order&lt;/script&gt;");
      expect(html).not.toContain("<script>");
      expect(html).toContain("123");
      expect(html).toContain('aria-current="page"');
      expect(html).toContain(locale === "ru" ? "История покупок" : "Purchase history");
      expect(html).toContain('href="/workspace/purchases?page=1"');
      expect(html).not.toContain("checkout/submit");
    },
  );

  it("never exposes license keys, entitlement payloads or server IDs", async () => {
    const html = renderToStaticMarkup(await Licenses(input()));
    expect(state.licenses).toHaveBeenCalledWith("usr_current", 2, {
      page: 2,
      status: "all",
      binding: "all",
      term: "all",
      sort: "newest",
      q: "",
    });
    expect(html).toContain("&lt;script&gt;licensed&lt;/script&gt;");
    expect(html).not.toContain("PRIVATE-LICENSE-KEY");
    expect(html).not.toContain("PRIVATE-SERVER-ID");
    expect(html).toContain("Expired");
    expect(html).toContain('href="/workspace/licenses"');
  });

  it("never discloses buyer identities or simulates payout availability", async () => {
    const html = renderToStaticMarkup(await Sales(input()));
    expect(state.seller).toHaveBeenCalledWith("usr_current", 2);
    expect(html).toContain("&lt;script&gt;sold&lt;/script&gt;");
    expect(html).not.toContain("PRIVATE-BUYER");
    expect(html).not.toContain("private@example.test");
    expect(html).toContain("gross");
    expect(html).not.toContain('name="withdraw"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
  });

  it("recovers with ErrorState when sales history fails to load", async () => {
    state.seller.mockRejectedValue(new Error("db unavailable"));
    const copy = getCommerceHistoryCopy("en");
    const html = renderToStaticMarkup(await Sales(input()));
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.salesLoadUnavailable);
    expect(html).toContain(copy.salesLoadUnavailableHint);
    expect(html).toContain(getDictionary("en").errors.retry);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/workspace/sales?page=2"');
  });

  it("renders EmptyState when sales history has no completed sales", async () => {
    state.seller.mockResolvedValue({
      sales: [],
      total: 0,
      page: 1,
      totalPages: 1,
      pageSize: 20,
    });
    const copy = getCommerceHistoryCopy("en");
    const html = renderToStaticMarkup(await Sales({ searchParams: Promise.resolve({}) }));
    expect(html).toContain(copy.emptySales);
    expect(html).toContain(copy.emptySalesHint);
    expect(html).toContain("overflow-x-clip");
  });
  it("renders archive filters in both languages and preserves them in export and page links", async () => {
    for (const locale of ["en", "ru"] as const) {
      state.locale = locale;
      const html = renderToStaticMarkup(
        await Licenses({
          searchParams: Promise.resolve({
            page: "2",
            status: "expiring",
            binding: "bound",
            term: "finite",
            sort: "expires_soon",
            q: "100%_",
          }),
        }),
      );
      expect(html).toContain(
        locale === "ru" ? "Экспорт показанной страницы" : "Export displayed page",
      );
      expect(html).toContain('name="binding"');
      expect(html).toContain('name="term"');
      expect(html).toContain(
        "/api/licenses/export?page=2&amp;status=expiring&amp;binding=bound&amp;term=finite&amp;sort=expires_soon&amp;q=100%25_",
      );
      expect(state.licenses).toHaveBeenCalledWith("usr_current", 2, {
        page: 2,
        status: "expiring",
        binding: "bound",
        term: "finite",
        sort: "expires_soon",
        q: "100%_",
      });
      expect(html).not.toContain("PRIVATE-LICENSE-KEY");
      expect(html).not.toContain("PRIVATE-SERVER-ID");
    }
  });

  it("clamps malformed page inputs before any repository access", async () => {
    await Purchases({ searchParams: Promise.resolve({ page: ["1", "2"] }) });
    expect(state.buyer).toHaveBeenCalledWith("usr_current", 1);
  });

  it("keeps all historical pages out of search engines", () => {
    for (const metadata of [purchasesMeta, licensesMeta, salesMeta]) {
      expect(metadata.robots).toMatchObject({ index: false, follow: false });
    }
  });

  it("recovers with ErrorState when license archive fails to load", async () => {
    state.licenses.mockRejectedValue(new Error("db unavailable"));
    const copy = getCommerceHistoryCopy("en");
    const html = renderToStaticMarkup(
      await Licenses({
        searchParams: Promise.resolve({
          page: "2",
          status: "expiring",
          binding: "bound",
          term: "finite",
          sort: "expires_soon",
          q: "alpha",
        }),
      }),
    );
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.loadUnavailable);
    expect(html).toContain(getDictionary("en").errors.retry);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain(
      'href="/workspace/licenses?page=2&amp;status=expiring&amp;binding=bound&amp;term=finite&amp;sort=expires_soon&amp;q=alpha"',
    );
    expect(html).not.toContain("PRIVATE-LICENSE-KEY");
  });

  it("renders EmptyState for an empty filtered license archive", async () => {
    state.licenses.mockResolvedValue({
      licenses: [],
      total: 0,
      page: 1,
      totalPages: 1,
      pageSize: 20,
    });
    const copy = getCommerceHistoryCopy("en");
    const maintenance = getLicenseMaintenanceCopy("en");
    const html = renderToStaticMarkup(
      await Licenses({
        searchParams: Promise.resolve({ status: "expired", q: "missing" }),
      }),
    );
    expect(html).toContain(copy.emptyLicensesFiltered);
    expect(html).toContain(copy.licenseNotice);
    expect(html).toContain(maintenance.clear);
    expect(html).toContain('href="/workspace/licenses"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
  });

  it("clips the honest license archive loading shell on narrow layouts", async () => {
    const html = renderToStaticMarkup(await LicensesLoading());
    expect(html).toContain("min-w-0 max-w-5xl");
    expect(html).toContain("overflow-x-clip");
  });

  it("recovers with ErrorState when purchase history fails to load", async () => {
    state.buyer.mockRejectedValue(new Error("db unavailable"));
    const copy = getCommerceHistoryCopy("en");
    const html = renderToStaticMarkup(await Purchases(input()));
    expect(html).toContain('role="alert"');
    expect(html).toContain(copy.purchasesLoadUnavailable);
    expect(html).toContain(copy.purchasesLoadUnavailableHint);
    expect(html).toContain(getDictionary("en").errors.retry);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-h-11");
    expect(html).toContain('href="/workspace/purchases?page=2"');
  });

  it("renders EmptyState when purchase history has no orders", async () => {
    state.buyer.mockResolvedValue({
      orders: [],
      total: 0,
      page: 1,
      totalPages: 1,
      pageSize: 20,
    });
    const copy = getCommerceHistoryCopy("en");
    const html = renderToStaticMarkup(await Purchases({ searchParams: Promise.resolve({}) }));
    expect(html).toContain(copy.emptyPurchases);
    expect(html).toContain(copy.emptyPurchasesHint);
    expect(html).toContain("overflow-x-clip");
  });

  it("clips the honest purchases loading shell on narrow layouts", async () => {
    const html = renderToStaticMarkup(await PurchasesLoading());
    expect(html).toContain("min-w-0 max-w-5xl");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain(getCommerceHistoryCopy("en").loading);
  });
});
