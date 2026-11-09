import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  statement: vi.fn(),
  scopes: vi.fn(),
  page: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/workspace/finance",
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("@nexus/db", () => ({
  financialStatementsRepository: { statement: state.statement, scopes: state.scopes },
  financialReviewRepository: { page: state.page, detail: state.detail },
}));

import { AppError } from "@nexus/domain";
import DetailLoading from "../../apps/web/src/app/admin/commerce/reconciliation/[id]/loading";
import Detail from "../../apps/web/src/app/admin/commerce/reconciliation/[id]/page";
import ReviewLoading from "../../apps/web/src/app/admin/commerce/reconciliation/loading";
import Review from "../../apps/web/src/app/admin/commerce/reconciliation/page";
import FinanceLoading from "../../apps/web/src/app/workspace/finance/loading";
import Statement, { metadata } from "../../apps/web/src/app/workspace/finance/page";
import { getFinancialCopy } from "../../apps/web/src/lib/financial-i18n";

const now = new Date("2026-10-11T00:00:00Z"),
  bounds = { page: 2, totalPages: 3, total: 41 };
const input = {
  params: Promise.resolve({ id: "ord_a" }),
  searchParams: Promise.resolve({ page: "2", currency: "EUR" }),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.statement.mockReset().mockResolvedValue({
    scope: { name: null },
    totals: [
      {
        currency: "EUR",
        balance: "123",
        credits: "200",
        debits: "-77",
        legacyEntries: 1,
        available: 123,
      },
    ],
    entries: [
      {
        id: "leg_a",
        amount: 123,
        balanceAfter: 123,
        currency: "EUR",
        createdAt: now,
        referenceType: "fee",
        referenceId: "ref_a",
        description: "SECRET-DESCRIPTION",
      },
    ],
    ...bounds,
  });
  state.scopes
    .mockReset()
    .mockResolvedValue({ scopes: [{ id: "org_a", name: "<Organization>" }], ...bounds });
  state.page.mockReset().mockResolvedValue({
    orders: [
      {
        id: "ord_a",
        orderNumber: "<ORDER>",
        status: "completed",
        amount: 123,
        currency: "EUR",
        missingCapture: true,
      },
    ],
    ...bounds,
  });
  state.detail.mockReset().mockResolvedValue({
    order: {
      orderNumber: "<ORDER>",
      status: "completed",
      amount: 123,
      currency: "EUR",
      missingCapture: true,
    },
    attempts: [
      {
        id: "pay_a",
        status: "completed",
        amount: 123,
        currency: "EUR",
        createdAt: now,
        providerTransactionId: "SECRET-PROVIDER",
        failureReason: "SECRET-FAILURE",
      },
    ],
    ledgerTotals: [{ currency: "EUR", net: "0", entries: 2 }],
    ...bounds,
  });
});
it("authenticates before reading statements", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await Statement(input))).toContain("/auth/login");
  expect(state.statement).not.toHaveBeenCalled();
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});
it.each(["en", "ru"] as const)(
  "renders exact currency amounts, with availability unknown in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(await Statement(input));
    expect(html).toContain(locale === "ru" ? "1,23 EUR" : "1.23 EUR");
    expect(html).toContain(locale === "ru" ? "Не сверено" : "Not reconciled");
    expect(html).not.toContain("SECRET-DESCRIPTION");
    expect(html).toContain("&lt;Organization&gt;");
    expect(html).toContain("currency=EUR");
    // The all-currencies link actually clears a previous currency filter.
    expect(html).toMatch(/href="\/workspace\/finance\?page=1&amp;scopePage=2"/u);
  },
);
it("refuses financial review for general moderators", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  await expect(Review(input)).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.page).not.toHaveBeenCalled();
});
it("shows recorded discrepancies and safe attempts without settlement actions or secrets", async () => {
  state.user = { id: "usr_a", role: "admin" };
  const queue = renderToStaticMarkup(await Review(input)),
    html = renderToStaticMarkup(await Detail(input));
  expect(queue).toContain("Paid order has no recorded capture");
  expect(html).toContain("&lt;ORDER&gt;");
  expect(html).toContain("Completed (record)");
  expect(html).not.toContain("SECRET-PROVIDER");
  expect(html).not.toContain("SECRET-FAILURE");
  expect(html).not.toContain("<form");
  expect(html).toContain("page=3");
  expect(html).toContain("overflow-x-clip");
});
it("shows an honest recovery state when the reconciliation queue fails", async () => {
  state.user = { id: "usr_a", role: "admin" };
  state.page.mockRejectedValue(new Error("reconciliation unavailable"));
  const copy = getFinancialCopy("en");
  const html = renderToStaticMarkup(
    await Review({ searchParams: Promise.resolve({ page: "2", filter: "review" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/admin/commerce/reconciliation?filter=review&amp;page=2"');
  expect(html).not.toContain("&lt;ORDER&gt;");
});
it("renders an empty review queue with clear-filters recovery when the review filter is active", async () => {
  state.user = { id: "usr_a", role: "admin" };
  state.page.mockResolvedValue({ orders: [], page: 1, totalPages: 1, pageSize: 20, total: 0 });
  const copy = getFinancialCopy("en");
  const html = renderToStaticMarkup(
    await Review({ searchParams: Promise.resolve({ filter: "review" }) }),
  );
  expect(html).toContain(copy.empty);
  expect(html).toContain(copy.clearFilters);
  expect(html).toContain('href="?filter=all"');
  expect(html).toContain("overflow-x-clip");
});
it("rejects stale admin privilege before loading the reconciliation queue", async () => {
  state.user = { id: "usr_a", role: "admin" };
  state.page.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(Review({ searchParams: Promise.resolve({}) })).rejects.toThrow("NEXT_NOT_FOUND");
});
it("shows an honest recovery state when recorded order evidence fails", async () => {
  state.user = { id: "usr_a", role: "admin" };
  state.detail.mockRejectedValue(new Error("detail unavailable"));
  const copy = getFinancialCopy("en");
  const html = renderToStaticMarkup(await Detail(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/admin/commerce/reconciliation/ord_a?page=2"');
});
it("clips honest loading shells on narrow layouts", async () => {
  for (const Loading of [ReviewLoading, DetailLoading]) {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain("min-w-0");
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain(getFinancialCopy("en").reviewLoading);
  }
  const financeLoading = renderToStaticMarkup(await FinanceLoading());
  expect(financeLoading).toContain("min-w-0");
  expect(financeLoading).toContain("overflow-x-clip");
  expect(financeLoading).toContain(getFinancialCopy("en").loading);
});
it("shows an honest recovery state when workspace statements fail to load", async () => {
  state.statement.mockRejectedValueOnce(new Error("statements unavailable"));
  state.scopes.mockResolvedValueOnce({ scopes: [], page: 1, totalPages: 1, total: 0 });
  const copy = getFinancialCopy("en");
  const html = renderToStaticMarkup(
    await Statement({ searchParams: Promise.resolve({ page: "2" }) }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.statementsLoadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain('href="/workspace/finance?page=2&amp;scopePage=1"');
  expect(html).not.toContain("statements unavailable");
});
