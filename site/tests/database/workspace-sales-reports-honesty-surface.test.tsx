import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

let root = dirname(fileURLToPath(import.meta.url));
while (!existsSync(join(root, "pnpm-workspace.yaml"))) root = dirname(root);
const read = (relative: string) => readFileSync(join(root, relative), "utf8");

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import ReportsLoading from "../../src/app/workspace/reports/loading";
import SalesLoading from "../../src/app/workspace/sales/loading";
import { getCommerceHistoryCopy } from "../../src/lib/commerce-history-i18n";
import { communityReportCopy } from "../../src/lib/community-report-copy";
import { sellerSalesCopy } from "../../src/lib/seller-sales-i18n";

beforeEach(() => {
  state.locale = "en";
});

it.each([
  [
    "sales",
    SalesLoading,
    "sales-loading-heading",
    () => getCommerceHistoryCopy("en").salesTitle,
    () => getCommerceHistoryCopy("en").loading,
  ],
  [
    "reports",
    ReportsLoading,
    "workspace-reports-loading-heading",
    () => communityReportCopy("en").title,
    () => communityReportCopy("en").loading,
  ],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingId, title, loading) => {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`id="${headingId}"`);
    expect(html).toContain(title());
    expect(html).toContain(loading());
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('role="status"');
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s sales loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = getCommerceHistoryCopy(locale);
    const html = renderToStaticMarkup(await SalesLoading());
    expect(html).toContain(copy.salesTitle);
    expect(html).toContain(copy.loading);
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks sales honesty chrome with ErrorState EmptyState clip and touch", () => {
  const source = read("site/src/app/workspace/sales/page.tsx");
  expect(source).toContain("ErrorState");
  expect(source).toContain("EmptyState");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toMatch(/min-h-11|size="touch"/u);
  expect(source).toContain('"en" | "ru"');
  expect(source).toContain("salesLoadUnavailable");
  expect(source).toContain("salesLoadUnavailableHint");
  expect(source).toContain("emptySalesHint");
  expect(source).toContain(".catch(() => null)");
  expect(source).not.toContain('role="alert"');
});

it("locks sales report honesty chrome with ErrorState recovery and no plain alert", () => {
  const source = read("site/src/app/workspace/sales/report/page.tsx");
  expect(source).toContain("ErrorState");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("min-h-11");
  expect(source).toContain("loadUnavailableHint");
  expect(source).toContain("invalidDescription");
  expect(source).toContain("c.reset");
  expect(source).not.toContain('role="alert"');
  expect(source).toContain(".catch(() => null)");
});

it("locks seller sales report apply CTA to size=touch", () => {
  const source = read("site/src/components/seller-sales-report.tsx");
  expect(source).toContain('size="touch"');
  expect(source).toMatch(/type="submit"[^>]*size="touch"|size="touch"[^>]*type="submit"/u);
  expect(source).toContain("min-h-11");
  expect(source).not.toContain("min-h-10");
});

it("locks seller sales report filter panel as a localized search landmark with touch select chrome", () => {
  const source = read("site/src/components/seller-sales-report.tsx");
  expect(source).toContain("<search aria-label={c.filters}>");
  expect(source).toMatch(
    /<select[\s\S]*?className="block min-h-11 w-full rounded border border-base bg-surface p-2"/u,
  );
  expect(source).not.toMatch(
    /<select[\s\S]*?className="block w-full rounded border border-base bg-surface p-2"/u,
  );
  const en = sellerSalesCopy("en");
  const ru = sellerSalesCopy("ru");
  expect(en.filters).toBe("Sales filters");
  expect(ru.filters).toBe("Фильтры продаж");
});

it("locks additive seller sales honesty copy for report recovery", () => {
  const i18n = read("site/src/lib/seller-sales-i18n.ts");
  expect(i18n).toContain("loadUnavailableHint");
  expect(i18n).toContain("invalidDescription");
  expect(i18n).toContain("filters:");
  const en = sellerSalesCopy("en");
  const ru = sellerSalesCopy("ru");
  expect(en.loadUnavailableHint).not.toBe("");
  expect(en.invalidDescription).not.toBe("");
  expect(en.filters).not.toBe("");
  expect(ru.loadUnavailableHint).not.toBe("");
  expect(ru.invalidDescription).not.toBe("");
  expect(ru.filters).not.toBe("");
});

it("locks reports route shell to clipped min-w-0 frame with Locale narrowed", () => {
  const source = read("site/src/app/workspace/reports/page.tsx");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("pageShellClass");
  expect(source).toContain('"en" | "ru"');
  expect(source).toContain("CommunityReportScreen");
});

it("keeps colocated sales and reports loadings clipped", () => {
  for (const loading of [
    "site/src/app/workspace/sales/loading.tsx",
    "site/src/app/workspace/reports/loading.tsx",
  ]) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }
});

it("locks additive sales honesty copy in commerce history i18n", () => {
  const history = read("site/src/lib/commerce-history-i18n.ts");
  expect(history).toContain("salesLoadUnavailable");
  expect(history).toContain("salesLoadUnavailableHint");
  expect(history).toContain("emptySalesHint");
  const en = getCommerceHistoryCopy("en");
  const ru = getCommerceHistoryCopy("ru");
  expect(en.salesLoadUnavailable).not.toBe("");
  expect(en.salesLoadUnavailableHint).not.toBe("");
  expect(en.emptySalesHint).not.toBe("");
  expect(ru.salesLoadUnavailable).not.toBe("");
  expect(ru.salesLoadUnavailableHint).not.toBe("");
  expect(ru.emptySalesHint).not.toBe("");
});
