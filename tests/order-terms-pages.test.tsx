import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  report: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
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
vi.mock("../apps/web/src/lib/services/order-terms-service", () => ({
  orderTermsService: { report: state.report },
}));

import Admin from "../apps/web/src/app/admin/commerce/reconciliation/[id]/terms/page";
import Buyer, { metadata } from "../apps/web/src/app/workspace/purchases/[id]/terms/page";
import { orderTermsCopy } from "../apps/web/src/lib/order-terms-i18n";

const input = {
    params: Promise.resolve({ id: "ord_a" }),
    searchParams: Promise.resolve({ page: "2" }),
  },
  date = new Date("2026-10-11T00:00:00Z");
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.report.mockResolvedValue({
    order: {
      id: "ord_a",
      orderNumber: "<script>order</script>",
      status: "pending",
      totalAmount: 100,
      currency: "USD",
      createdAt: date,
    },
    observedAt: date,
    lines: [
      {
        id: "itm_a",
        productId: "prd_a",
        unitPrice: 100,
        currency: "USD",
        evidence: "recorded",
        terms: {
          version: 1,
          recordedAt: date.toISOString(),
          product: { id: "prd_a", title: "<script>frozen</script>", slug: "resource" },
          seller: { type: "user", id: "usr_seller" },
          line: { unitPrice: 100, currency: "USD" },
          baseline: { commissionBps: 1000, holdDays: 7, licenseModel: "single_server" },
        },
      },
      {
        id: "itm_b",
        productId: "prd_b",
        unitPrice: 0,
        currency: "USD",
        evidence: "legacy",
        terms: null,
      },
    ],
    summary: {
      lines: 21,
      legacyLines: 20,
      recordedLines: 1,
      totals: [{ currency: "USD", value: "100" }],
      amountMismatch: false,
      currencyMismatch: false,
      negativeValues: false,
      unsupportedCurrency: false,
    },
    page: 2,
    pageSize: 20,
    total: 21,
    totalPages: 3,
    buyerEmail: "PRIVATE-BUYER",
    licenseKey: "PRIVATE-LICENSE",
    providerKey: "PRIVATE-PROVIDER",
  });
});
it("signed-out buyers and non-admin staff cannot request terms pages", async () => {
  state.actor = null;
  expect(renderToStaticMarkup(await Buyer(input))).toContain('href="/auth/login"');
  await expect(Admin(input)).rejects.toThrow("NOT_FOUND");
  state.actor = { id: "usr_a", role: "moderator" };
  await expect(Admin(input)).rejects.toThrow("NOT_FOUND");
  expect(state.report).not.toHaveBeenCalled();
  expect(metadata.robots).toEqual({ index: false, follow: false });
});
it.each(["en", "ru"] as const)(
  "renders %s snapshots, unknown history and bounded pagination without simulated payments",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Buyer(input)),
      c = orderTermsCopy(locale);
    expect(state.report).toHaveBeenCalledWith(state.actor, "ord_a", "buyer", 2);
    expect(html).toContain(c.title);
    expect(html).toContain(c.notice);
    expect(html).toContain(c.legacy);
    expect(html).toContain("&lt;script&gt;frozen&lt;/script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("PRIVATE-BUYER");
    expect(html).not.toContain("PRIVATE-LICENSE");
    expect(html).not.toContain("PRIVATE-PROVIDER");
    expect(html).toContain("10%");
    expect(html).toContain(`/api/orders/ord_a/terms/export?page=2`);
    expect(html).toContain(`/workspace/purchases/ord_a/terms?page=3`);
    expect(html).not.toContain('name="pay"');
  },
);
it("admin pages retain explicit financial scope and their own navigation", async () => {
  state.actor = { id: "usr_a", role: "admin" };
  const html = renderToStaticMarkup(await Admin(input));
  expect(state.report).toHaveBeenCalledWith(state.actor, "ord_a", "admin", 2);
  expect(html).toContain("/api/admin/commerce/orders/ord_a/terms/export?page=2");
  expect(html).toContain("/admin/commerce/reconciliation/ord_a");
});
it("invalid query arrays and page sizes produce recovery without repository reads", async () => {
  const html = renderToStaticMarkup(
    await Buyer({ ...input, searchParams: Promise.resolve({ page: ["1", "2"] }) }),
  );
  expect(html).toContain('role="alert"');
  expect(state.report).not.toHaveBeenCalled();
});
it("unavailable order details are masked", async () => {
  state.report.mockRejectedValue(new AppError("Private order", 404, "NOT_FOUND"));
  await expect(Buyer(input)).rejects.toThrow("NOT_FOUND");
});
