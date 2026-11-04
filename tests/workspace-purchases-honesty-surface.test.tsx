import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import OrderCaseDetailLoading from "../apps/web/src/app/workspace/order-cases/[id]/loading";
import OrderCasesLoading from "../apps/web/src/app/workspace/order-cases/loading";
import PurchaseDetailLoading from "../apps/web/src/app/workspace/purchases/[id]/loading";
import PurchaseSupportLoading from "../apps/web/src/app/workspace/purchases/[id]/support/loading";
import PurchasesLoading from "../apps/web/src/app/workspace/purchases/loading";
import ReviewReportDetailLoading from "../apps/web/src/app/workspace/review-reports/[id]/loading";
import ReviewReportsLoading from "../apps/web/src/app/workspace/review-reports/loading";
import { getCommerceHistoryCopy } from "../apps/web/src/lib/commerce-history-i18n";
import { orderCaseCopy } from "../apps/web/src/lib/order-case-i18n";
import { resourceReviewCopy } from "../apps/web/src/lib/resource-review-i18n";

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
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
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
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks purchases and order-case honesty chrome in exclusive page sources", () => {
  const purchasesPages = [
    "apps/web/src/app/workspace/purchases/page.tsx",
    "apps/web/src/app/workspace/purchases/[id]/page.tsx",
  ];
  for (const page of purchasesPages) {
    const source = read(page);
    expect(source).toContain("ErrorState");
    expect(source).toContain("EmptyState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).toContain('"en" | "ru"');
    expect(source).not.toContain('role="alert"');
  }

  const shellPages = [
    "apps/web/src/app/workspace/purchases/[id]/support/page.tsx",
    "apps/web/src/app/workspace/order-cases/page.tsx",
    "apps/web/src/app/workspace/order-cases/[id]/page.tsx",
    "apps/web/src/app/workspace/review-reports/page.tsx",
    "apps/web/src/app/workspace/review-reports/[id]/page.tsx",
  ];
  for (const page of shellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }

  for (const loading of [
    "apps/web/src/app/workspace/purchases/loading.tsx",
    "apps/web/src/app/workspace/purchases/[id]/loading.tsx",
    "apps/web/src/app/workspace/purchases/[id]/support/loading.tsx",
    "apps/web/src/app/workspace/order-cases/loading.tsx",
    "apps/web/src/app/workspace/order-cases/[id]/loading.tsx",
    "apps/web/src/app/workspace/review-reports/loading.tsx",
    "apps/web/src/app/workspace/review-reports/[id]/loading.tsx",
  ]) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain('"en" | "ru"');
  }

  const history = read("apps/web/src/lib/commerce-history-i18n.ts");
  expect(history).toContain("purchasesLoadUnavailable");
  expect(history).toContain("purchasesLoadUnavailableHint");
  expect(history).toContain("orderLoadUnavailable");
  expect(history).toContain("orderLoadUnavailableHint");
  expect(history).toContain("emptyPurchasesHint");
  expect(history).toContain("emptyItemsHint");
  expect(read("apps/web/src/lib/order-case-i18n.ts")).toContain("loading:");
  expect(read("apps/web/src/lib/order-case-i18n.ts")).toContain("loadUnavailableHint");
  expect(read("apps/web/src/lib/resource-review-i18n.ts")).toContain("loadUnavailableHint");
  expect(read("apps/web/src/components/order-case-page.tsx")).toContain("loadUnavailableHint");
  expect(read("apps/web/src/components/resource-review-report-screen.tsx")).toContain(
    "loadUnavailableHint",
  );
});
