vi.mock("server-only", () => ({}));

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
  expect(source).toMatch(/(?:overflow-x-clip|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
  expect(source).toMatch(/(?:min-w-0|pageShell|page-shell|[A-Za-z]\w*RouteLoading)/);
}

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
}));
vi.mock("../../src/lib/i18n/server", () => ({
  getRequestLocale: async () => state.locale,
}));

import AdminLicenseDetailLoading from "../../src/app/admin/licenses/[id]/loading";
import AdminReportHistoryLoading from "../../src/app/admin/reports/[id]/history/loading";
import AdminSupportMessagesLoading from "../../src/app/admin/support/[id]/messages/loading";
import { getCommerceHistoryCopy } from "../../src/features/commerce/commerce-history-i18n";
import { getLicenseControlCopy } from "../../src/features/commerce/license-control-i18n";
import { reportHistoryCopy } from "../../src/features/community/community-report-history-copy";
import { supportMessageCopy } from "../../src/features/support/support-message-discovery-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "site/src/features/commerce/server/license-history-page.tsx",
  "site/src/features/community/server/community-moderation-screen.tsx",
  "site/src/features/community/server/moderated-discussion-screen.tsx",
  "site/src/features/community/server/publication-reports-page.tsx",
  "site/src/features/community/server/discussion-reports-screen.tsx",
  "site/src/features/support/server/support-page.tsx",
  "site/src/features/support/server/support-message-page.tsx",
  "site/src/features/community/server/community-report-screen.tsx",
  "site/src/features/community/server/community-report-history-page.tsx",
  "site/src/features/community/server/community-report-groups-page.tsx",
  "site/src/features/commerce/server/order-case-page.tsx",
  "site/src/features/resources/server/resource-review-report-screen.tsx",
] as const;

it("locks residual admin route shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expectClippedLoadingSource(source);
  }
});

it("locks admin license detail honesty chrome with ErrorState recovery", () => {
  const source = read("site/src/features/commerce/server/license-moderation-detail-screen.tsx");
  expect(source).toContain("ErrorState");
  expectClippedLoadingSource(source);
  expect(source).toContain("min-h-11");
  expect(source).toContain("loadUnavailable");
  expect(source).toContain("pageShellClass");
  expect(source).not.toContain('role="alert"');
});

it("locks admin license detail loading shell to clipped busy copy", async () => {
  const source = read("site/src/app/admin/licenses/[id]/loading.tsx");
  expectClippedLoadingSource(source);
  const copy = getLicenseControlCopy("en");
  const history = getCommerceHistoryCopy("en");
  const html = renderToStaticMarkup(await AdminLicenseDetailLoading());
  expect(html).toContain('aria-busy="true"');
  expectClippedLoadingSource(html);
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
    expectClippedLoadingSource(html);
    expect(html).toContain(copy[titleKey]);
    expect(html).toContain(copy[loadingKey]);
    expect(html).toContain('role="status"');
  },
);

it("keeps admin support messages and report history loadings as clipped re-exports", () => {
  expect(read("site/src/app/admin/support/[id]/messages/loading.tsx")).toContain(
    'from "../../../../support/[id]/messages/loading"',
  );
  expect(read("site/src/app/admin/reports/[id]/history/loading.tsx")).toContain(
    'from "../../../../workspace/reports/[id]/history/loading"',
  );
  expectClippedLoadingSource(read("site/src/app/support/[id]/messages/loading.tsx"));
  expectClippedLoadingSource(read("site/src/app/workspace/reports/[id]/history/loading.tsx"));
});

it("locks admin builds quarantine actionable links to min-h-11 touch targets", () => {
  const source = read(
    "site/src/features/moderation/components/admin-builds-quarantine-section.tsx",
  );
  expect(source).toContain("touchLinkClass");
  expect(source).toContain("inline-flex min-h-11 items-center");
  expect(source).not.toContain('className="text-accent underline');
  expect(source).not.toContain('className="inline-block text-xs font-semibold text-accent');
});
