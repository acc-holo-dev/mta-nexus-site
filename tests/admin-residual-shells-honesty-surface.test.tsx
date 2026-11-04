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

import AdminLicenseDetailLoading from "../apps/web/src/app/admin/licenses/[id]/loading";
import AdminReportHistoryLoading from "../apps/web/src/app/admin/reports/[id]/history/loading";
import AdminSupportMessagesLoading from "../apps/web/src/app/admin/support/[id]/messages/loading";
import { getCommerceHistoryCopy } from "../apps/web/src/lib/commerce-history-i18n";
import { reportHistoryCopy } from "../apps/web/src/lib/community-report-history-copy";
import { getLicenseControlCopy } from "../apps/web/src/lib/license-control-i18n";
import { supportMessageCopy } from "../apps/web/src/lib/support-message-discovery-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "apps/web/src/app/admin/licenses/[id]/history/page.tsx",
  "apps/web/src/app/admin/community/page.tsx",
  "apps/web/src/app/admin/community/[id]/page.tsx",
  "apps/web/src/app/admin/community/[id]/reports/page.tsx",
  "apps/web/src/app/admin/community/[id]/discussion/page.tsx",
  "apps/web/src/app/admin/community/[id]/discussion/[commentId]/page.tsx",
  "apps/web/src/app/admin/community/[id]/discussion/[commentId]/reports/page.tsx",
  "apps/web/src/app/admin/support/page.tsx",
  "apps/web/src/app/admin/support/[id]/page.tsx",
  "apps/web/src/app/admin/support/[id]/messages/page.tsx",
  "apps/web/src/app/admin/reports/page.tsx",
  "apps/web/src/app/admin/reports/[id]/page.tsx",
  "apps/web/src/app/admin/reports/[id]/history/page.tsx",
  "apps/web/src/app/admin/reports/targets/page.tsx",
  "apps/web/src/app/admin/commerce/order-cases/page.tsx",
  "apps/web/src/app/admin/commerce/order-cases/[id]/page.tsx",
  "apps/web/src/app/admin/commerce/reviews/page.tsx",
  "apps/web/src/app/admin/commerce/reviews/[id]/page.tsx",
] as const;

it("locks residual admin route shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("locks admin license detail honesty chrome with ErrorState recovery", () => {
  const source = read("apps/web/src/app/admin/licenses/[id]/page.tsx");
  expect(source).toContain("ErrorState");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  expect(source).toContain("min-h-11");
  expect(source).toContain("loadUnavailable");
  expect(source).toContain("pageShellClass");
  expect(source).not.toContain('role="alert"');
});

it("locks admin license detail loading shell to clipped busy copy", async () => {
  const source = read("apps/web/src/app/admin/licenses/[id]/loading.tsx");
  expect(source).toContain("overflow-x-clip");
  expect(source).toContain("min-w-0");
  const copy = getLicenseControlCopy("en");
  const history = getCommerceHistoryCopy("en");
  const html = renderToStaticMarkup(await AdminLicenseDetailLoading());
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
  expect(html).toContain(copy.title);
  expect(html).toContain(history.loading);
  expect(html).toContain('role="status"');
});

it.each([
  [
    "admin support messages",
    AdminSupportMessagesLoading,
    () => supportMessageCopy("en"),
    "title",
    "loading",
  ],
  [
    "admin report history",
    AdminReportHistoryLoading,
    () => reportHistoryCopy("en"),
    "title",
    "loading",
  ],
] as const)(
  "keeps the %s loading re-export clipped without inventing results",
  async (_name, Loading, copyOf, titleKey, loadingKey) => {
    const copy = copyOf();
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain(copy[titleKey]);
    expect(html).toContain(copy[loadingKey]);
    expect(html).toContain('role="status"');
  },
);

it("keeps admin support messages and report history loadings as clipped re-exports", () => {
  expect(read("apps/web/src/app/admin/support/[id]/messages/loading.tsx")).toContain(
    'from "../../../../support/[id]/messages/loading"',
  );
  expect(read("apps/web/src/app/admin/reports/[id]/history/loading.tsx")).toContain(
    'from "../../../../workspace/reports/[id]/history/loading"',
  );
  expect(read("apps/web/src/app/support/[id]/messages/loading.tsx")).toContain("overflow-x-clip");
  expect(read("apps/web/src/app/workspace/reports/[id]/history/loading.tsx")).toContain(
    "overflow-x-clip",
  );
});
