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

import ReportsLoading from "../apps/web/src/app/workspace/reports/loading";
import SalesLoading from "../apps/web/src/app/workspace/sales/loading";
import { getCommerceHistoryCopy } from "../apps/web/src/lib/commerce-history-i18n";
import { communityReportCopy } from "../apps/web/src/lib/community-report-copy";

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
  const source = read("apps/web/src/app/workspace/sales/page.tsx");
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

it("locks reports route shell to clipped min-w-0 frame with Locale narrowed", () => {
  const source = read("apps/web/src/app/workspace/reports/page.tsx");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("pageShellClass");
  expect(source).toContain('"en" | "ru"');
  expect(source).toContain("CommunityReportScreen");
});

it("keeps colocated sales and reports loadings clipped", () => {
  for (const loading of [
    "apps/web/src/app/workspace/sales/loading.tsx",
    "apps/web/src/app/workspace/reports/loading.tsx",
  ]) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }
});

it("locks additive sales honesty copy in commerce history i18n", () => {
  const history = read("apps/web/src/lib/commerce-history-i18n.ts");
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
