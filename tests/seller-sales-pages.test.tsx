import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  report: vi.fn(),
  detail: vi.fn(),
  scopes: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/seller-sales-service", () => ({
  sellerSalesService: { report: state.report, detail: state.detail, scopes: state.scopes },
}));

import Detail from "../apps/web/src/app/workspace/sales/report/[id]/page";
import Page, { metadata } from "../apps/web/src/app/workspace/sales/report/page";
import { sellerSalesCopy } from "../apps/web/src/lib/seller-sales-i18n";

const date = new Date("2026-10-11T00:00:00Z"),
  sale = {
    id: "itm_a",
    productId: "prd_a",
    productTitle: "<script>sale</script>",
    orderNumber: "ORDER-A",
    status: "completed",
    unitPrice: 50,
    currency: "USD",
    createdAt: date,
    evidence: "capture_recorded",
    buyerEmail: "PRIVATE-BUYER",
    providerTransactionId: "PRIVATE-PROVIDER",
  };
const input = {
  searchParams: Promise.resolve({
    page: "2",
    days: "90",
    organizationId: "org_a",
    currency: "RUB",
    evidence: "review",
    productId: "prd_a",
  }),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.report.mockResolvedValue({
    scope: { id: "org:org_a", name: "<script>organization</script>" },
    product: { id: "prd_a", title: "<script>sale</script>" },
    observedAt: date,
    sales: [sale],
    totals: [
      { currency: "USD", lines: 21, orders: 20, gross: "9007199254740993", reviewLines: 2 },
      { currency: "OTHER", lines: 1, orders: 1, gross: null, reviewLines: 1 },
    ],
    periods: [{ period: "2026-10-01", currency: "USD", lines: 21, gross: "50" }],
    periodUnit: "month",
    periodStart: date,
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 3,
  });
  state.scopes.mockResolvedValue({
    scopes: [{ id: "org_a", name: "Organization" }],
    page: 2,
    totalPages: 3,
  });
  state.detail.mockResolvedValue({ sale, scope: { name: "Organization" }, observedAt: date });
});
it("does not read reports when signed out and disables indexing", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await Page(input))).toContain('href="/auth/login"');
  expect(
    renderToStaticMarkup(
      await Detail({
        ...input,
        params: Promise.resolve({ id: "itm_a" }),
        searchParams: Promise.resolve({}),
      }),
    ),
  ).toContain('href="/auth/login"');
  expect(state.report).not.toHaveBeenCalled();
  expect(state.detail).not.toHaveBeenCalled();
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
it.each(["en", "ru"] as const)(
  "renders %s filters and accurate per-currency records without private payment data",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Page(input)),
      copy = sellerSalesCopy(locale);
    expect(html).toContain(copy.title);
    expect(html).toContain("&lt;script&gt;sale&lt;/script&gt;");
    expect(html).toContain("&lt;script&gt;organization&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("PRIVATE-BUYER");
    expect(html).not.toContain("PRIVATE-PROVIDER");
    expect(html).toContain(copy.unknown);
    expect(html).toContain('action="/workspace/sales/report"');
    expect(html).toContain("/api/sales/export?page=2");
    expect(html).toContain("organizationId=org_a");
    expect(html).toContain("evidence=review");
    expect(html).toContain("scopePage=3");
    expect(html).toContain(copy.paymentNotice);
    expect(html).not.toContain('name="withdraw"');
  },
);
it("normalizes empty GET form controls and masks unauthorized products", async () => {
  await Page({ searchParams: Promise.resolve({ currency: "all", productId: "" }) });
  expect(state.report).toHaveBeenCalledWith(state.actor, {
    page: 1,
    days: "all",
    status: "completed",
    evidence: "all",
  });
  state.report.mockRejectedValue(new AppError("Private organization", 404, "NOT_FOUND"));
  await expect(Page(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("invalid filters render a localized recovery link before data reads", async () => {
  const html = renderToStaticMarkup(
    await Page({ searchParams: Promise.resolve({ userId: "other" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain('href="/workspace/sales/report"');
  expect(state.report).not.toHaveBeenCalled();
  expect(state.scopes).not.toHaveBeenCalled();
});
it("detail renders only its scoped line with safe management and return links", async () => {
  const html = renderToStaticMarkup(
    await Detail({
      params: Promise.resolve({ id: "itm_a" }),
      searchParams: Promise.resolve({ organizationId: "org_a" }),
    }),
  );
  expect(state.detail).toHaveBeenCalledWith(state.actor, "itm_a", "org_a");
  expect(html).toContain("&lt;script&gt;sale&lt;/script&gt;");
  expect(html).toContain("/workspace/resources/prd_a");
  expect(html).not.toContain("PRIVATE-BUYER");
  expect(html).not.toContain("PRIVATE-PROVIDER");
  expect(html).toContain("organizationId=org_a");
});
it("detail refuses unknown, repeated and unavailable account selectors", async () => {
  await expect(
    Detail({
      params: Promise.resolve({ id: "itm_a" }),
      searchParams: Promise.resolve({ userId: "other" }),
    }),
  ).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.detail).not.toHaveBeenCalled();
  state.detail.mockRejectedValue(new AppError("hidden", 404, "NOT_FOUND"));
  await expect(
    Detail({ params: Promise.resolve({ id: "itm_other" }), searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("NEXT_NOT_FOUND");
});
