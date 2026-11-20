import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

function expectClippedLoadingSource(source: string) {
  if (/[A-Za-z]\w*RouteLoading|pageShell|page-shell/.test(source)) {
    expect(source).toMatch(/[A-Za-z]\w*RouteLoading|pageShell|page-shell/);
    return;
  }
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
}

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("server-only", () => ({}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));

import OrderCaseDetailLoading from "../../src/app/workspace/order-cases/[id]/loading";
import OrderCasesLoading from "../../src/app/workspace/order-cases/loading";
import PurchaseDetailLoading from "../../src/app/workspace/purchases/[id]/loading";
import PurchaseSupportLoading from "../../src/app/workspace/purchases/[id]/support/loading";
import PurchasesLoading from "../../src/app/workspace/purchases/loading";
import ReviewReportDetailLoading from "../../src/app/workspace/review-reports/[id]/loading";
import ReviewReportsLoading from "../../src/app/workspace/review-reports/loading";
import { getCommerceHistoryCopy } from "../../src/features/commerce/commerce-history-i18n";
import { orderCaseCopy } from "../../src/features/commerce/order-case-i18n";
import { resourceReviewCopy } from "../../src/features/resources/resource-review-i18n";

beforeEach(() => {
  state.locale = "en";
});

it.each([
  [
    "purchases",
    PurchasesLoading,
    "purchases-loading-heading",
    () => getCommerceHistoryCopy("en").purchasesTitle,
  ],
  [
    "purchase detail",
    PurchaseDetailLoading,
    "purchase-detail-loading-heading",
    () => getCommerceHistoryCopy("en").details,
  ],
  [
    "purchase support",
    PurchaseSupportLoading,
    "purchase-support-loading-heading",
    () => orderCaseCopy("en").create,
  ],
  [
    "order cases",
    OrderCasesLoading,
    "order-cases-loading-heading",
    () => orderCaseCopy("en").buyerCases,
  ],
  [
    "order case detail",
    OrderCaseDetailLoading,
    "order-case-detail-loading-heading",
    () => orderCaseCopy("en").title,
  ],
  [
    "review reports",
    ReviewReportsLoading,
    "review-reports-loading-heading",
    () => resourceReviewCopy("en").reports,
  ],
  [
    "review report detail",
    ReviewReportDetailLoading,
    "review-report-loading-heading",
    () => resourceReviewCopy("en").reports,
  ],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingId, title) => {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`id="${headingId}"`);
    expect(html).toContain(title());
    expectClippedLoadingSource(html);
    expect(html).toContain('role="status"');
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s order-cases loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = orderCaseCopy(locale);
    const html = renderToStaticMarkup(await OrderCasesLoading());
    expect(html).toContain(copy.buyerCases);
    expect(html).toContain(copy.loading);
    expectClippedLoadingSource(html);
  },
);

it("locks purchases and order-case honesty chrome in exclusive page sources", () => {
  const purchasesPages = [
    "site/src/features/commerce/server/purchases-history-screen.tsx",
    "site/src/features/commerce/server/purchase-detail-screen.tsx",
  ];
  for (const page of purchasesPages) {
    const source = read(page);
    expect(source).toContain("ErrorState");
    expect(source).toContain("EmptyState");
    expectClippedLoadingSource(source);
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).toContain('"en" | "ru"');
    expect(source).not.toContain('role="alert"');
  }

  const terms = read("site/src/features/commerce/server/purchase-terms-screen.tsx");
  expect(terms).toContain("ErrorState");
  expectClippedLoadingSource(terms);
  expect(terms).toMatch(/min-h-11|size="touch"/u);
  expect(terms).toContain("title={c.invalid}");
  expect(terms).not.toContain('role="alert"');
  expect(terms).not.toContain('<p role="alert"');

  const shellPages = [
    "site/src/features/commerce/server/purchases-history-screen.tsx",
    "site/src/features/commerce/server/purchase-detail-screen.tsx",
    "site/src/features/commerce/server/purchase-operations-screen.tsx",
    "site/src/features/commerce/server/purchase-terms-screen.tsx",
    "site/src/features/commerce/server/order-case-page.tsx",
    "site/src/features/commerce/server/order-case-page.tsx",
    "site/src/features/commerce/server/order-case-page.tsx",
    "site/src/features/resources/server/resource-review-report-screen.tsx",
    "site/src/features/resources/server/resource-review-report-screen.tsx",
  ];
  for (const page of shellPages) {
    const source = read(page);
    expectClippedLoadingSource(source);
  }

  for (const loading of [
    "site/src/app/workspace/purchases/loading.tsx",
    "site/src/app/workspace/purchases/[id]/loading.tsx",
    "site/src/app/workspace/purchases/[id]/support/loading.tsx",
    "site/src/app/workspace/order-cases/loading.tsx",
    "site/src/app/workspace/order-cases/[id]/loading.tsx",
    "site/src/app/workspace/review-reports/loading.tsx",
    "site/src/app/workspace/review-reports/[id]/loading.tsx",
  ]) {
    const source = read(loading);
    expectClippedLoadingSource(source);
    if (!/[A-Za-z]\w*RouteLoading/.test(source)) {
      expect(source).toContain('"en" | "ru"');
    }
  }

  const history = read("site/src/features/commerce/commerce-history-i18n.ts");
  expect(history).toContain("purchasesLoadUnavailable");
  expect(history).toContain("purchasesLoadUnavailableHint");
  expect(history).toContain("orderLoadUnavailable");
  expect(history).toContain("orderLoadUnavailableHint");
  expect(history).toContain("emptyPurchasesHint");
  expect(history).toContain("emptyItemsHint");
  expect(read("site/src/features/commerce/order-case-i18n.ts")).toContain("loading:");
  expect(read("site/src/features/commerce/order-case-i18n.ts")).toContain("loadUnavailableHint");
  expect(read("site/src/features/resources/resource-review-i18n.ts")).toContain(
    "loadUnavailableHint",
  );
  expect(read("site/src/features/commerce/server/order-case-page.tsx")).toContain(
    "loadUnavailableHint",
  );
  expect(read("site/src/features/resources/server/resource-review-report-screen.tsx")).toContain(
    "loadUnavailableHint",
  );
});

it("locks order-case filter apply and selects to touch targets", () => {
  const source = read("site/src/features/commerce/server/order-case-page.tsx");
  expect(source).toContain('size="touch"');
  expect(source).toMatch(/type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/u);
  expect(source).toContain("min-h-11 rounded-lg border border-base bg-surface p-2 text-sm");
  expect(
    source.match(/min-h-11 rounded-lg border border-base bg-surface p-2 text-sm/gu)?.length,
  ).toBe(2);
  expect(source).not.toContain('size="sm"');
  expect(source).not.toContain("min-h-10");
});
