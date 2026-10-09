import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";

const state = vi.hoisted(() => ({
  user: { id: "usr_current" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  buyer: vi.fn(),
  licenses: vi.fn(),
  seller: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session" }) }),
}));
vi.mock("@nexus/db", () => ({
  orderRepository: {
    pageBuyerHistory: state.buyer,
    pageSellerHistory: state.seller,
  },
  licenseRepository: { pageUserHistory: state.licenses },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...rest }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...rest }, children),
  };
});

import Purchases, { metadata as purchasesMeta } from "../apps/web/src/app/workspace/purchases/page";
import Licenses, { metadata as licensesMeta } from "../apps/web/src/app/workspace/licenses/page";
import Sales, { metadata as salesMeta } from "../apps/web/src/app/workspace/sales/page";

const date = new Date("2026-10-09T10:00:00.000Z");
const input = (page = "2") => ({ searchParams: Promise.resolve({ page }) });

describe("private legacy commerce pages", () => {
  beforeEach(() => {
    state.user = { id: "usr_current" };
    state.locale = "en";
    state.buyer.mockReset().mockResolvedValue({
      orders: [{
        id: "ord_1",
        orderNumber: "<script>order</script>",
        status: "completed",
        totalAmount: 12345,
        currency: "USD",
        createdAt: date,
        buyerId: "usr_current",
      }],
      total: 21, page: 2, totalPages: 2, pageSize: 20,
    });
    state.licenses.mockReset().mockResolvedValue({
      licenses: [{
        id: "lic_1", productTitle: "<script>licensed</script>",
        key: "PRIVATE-LICENSE-KEY-NEVER-RENDER",
        userId: "usr_current", serverId: "PRIVATE-SERVER-ID",
        model: "single_server", status: "active",
        expiresAt: new Date("2020-01-01T00:00:00Z"),
        createdAt: date, serverBound: true,
      }],
      total: 21, page: 2, totalPages: 2, pageSize: 20,
    });
    state.seller.mockReset().mockResolvedValue({
      sales: [{
        id: "itm_1", productTitle: "<script>sold</script>",
        orderNumber: "ORD-001", unitPrice: 4500,
        currency: "USD", createdAt: date,
        buyerId: "PRIVATE-BUYER", buyerEmail: "private@example.test",
      }],
      total: 21, page: 2, totalPages: 2, pageSize: 20,
    });
  });

  it("does not query buyer, license or seller history while signed out", async () => {
    state.user = null;
    for (const Component of [Purchases, Licenses, Sales]) {
      const html = renderToStaticMarkup(await Component(input()));
      expect(html).toContain('href="/auth/login"');
    }
    expect(state.buyer).not.toHaveBeenCalled();
    expect(state.licenses).not.toHaveBeenCalled();
    expect(state.seller).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)("localizes purchases and escapes order IDs in %s", async locale => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Purchases(input()));
    expect(state.buyer).toHaveBeenCalledWith("usr_current", 2);
    expect(html).toContain("&lt;script&gt;order&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("123");
    expect(html).toContain("aria-current=\"page\"");
    expect(html).toContain(locale === "ru" ? "История покупок" : "Purchase history");
    expect(html).toContain('href="/workspace/purchases?page=1"');
    expect(html).not.toContain("checkout/submit");
  });

  it("never exposes license keys, entitlement payloads or server IDs", async () => {
    const html = renderToStaticMarkup(await Licenses(input()));
    expect(state.licenses).toHaveBeenCalledWith("usr_current", 2);
    expect(html).toContain("&lt;script&gt;licensed&lt;/script&gt;");
    expect(html).not.toContain("PRIVATE-LICENSE-KEY");
    expect(html).not.toContain("PRIVATE-SERVER-ID");
    expect(html).toContain("Expired");
    expect(html).toContain('href="/workspace/licenses?page=1"');
  });

  it("never discloses buyer identities or simulates payout availability", async () => {
    const html = renderToStaticMarkup(await Sales(input()));
    expect(state.seller).toHaveBeenCalledWith("usr_current", 2);
    expect(html).toContain("&lt;script&gt;sold&lt;/script&gt;");
    expect(html).not.toContain("PRIVATE-BUYER");
    expect(html).not.toContain("private@example.test");
    expect(html).toContain("gross");
    expect(html).not.toContain('name="withdraw"');
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
});
