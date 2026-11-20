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

import AdminReportHistoryLoading from "../../src/app/admin/reports/[id]/history/loading";
import AdminResourceBuildLoading from "../../src/app/admin/resources/[id]/builds/[buildId]/loading";
import AdminResourceBuildPackageLoading from "../../src/app/admin/resources/[id]/builds/[buildId]/package/loading";
import AdminResourceDetailLoading from "../../src/app/admin/resources/[id]/loading";
import AdminResourceMediaLoading from "../../src/app/admin/resources/[id]/media/loading";
import AdminResourceRequirementsLoading from "../../src/app/admin/resources/[id]/requirements/loading";
import AdminResourcesLoading from "../../src/app/admin/resources/loading";
import AdminSupportMessagesLoading from "../../src/app/admin/support/[id]/messages/loading";
import { reportHistoryCopy } from "../../src/features/community/community-report-history-copy";
import { getResourceReleaseControlCopy } from "../../src/features/library/resource-release-control-i18n";
import { buildPackageCopy } from "../../src/features/resources/build-package-i18n";
import { getResourceBuildWorkspaceCopy } from "../../src/features/resources/resource-build-workspace-i18n";
import { resourceMediaCopy } from "../../src/features/resources/resource-media-i18n";
import { resourceRequirementsCopy } from "../../src/features/resources/resource-requirements-i18n";
import { supportMessageCopy } from "../../src/features/support/support-message-discovery-copy";
import { getDictionary } from "../../src/lib/i18n";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "site/src/features/resources/server/media-screen.tsx",
  "site/src/features/resources/server/resource-requirements-screen.tsx",
  "site/src/features/resources/server/build-screen.tsx",
  "site/src/features/resources/server/build-package-screen.tsx",
] as const;

const clippedResourceLoadings = [
  "site/src/app/admin/resources/loading.tsx",
  "site/src/app/admin/resources/[id]/loading.tsx",
  "site/src/app/admin/resources/[id]/media/loading.tsx",
  "site/src/app/admin/resources/[id]/requirements/loading.tsx",
  "site/src/app/admin/resources/[id]/builds/[buildId]/loading.tsx",
  "site/src/app/admin/resources/[id]/builds/[buildId]/package/loading.tsx",
] as const;

it("locks admin resource route shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expectClippedLoadingSource(source);
  }
});

it("locks sibling admin resource loadings to clipped busy frames", () => {
  for (const loading of clippedResourceLoadings) {
    expectClippedLoadingSource(read(loading));
  }
});

it.each([
  ["resources", AdminResourcesLoading, () => getResourceReleaseControlCopy("en").moderation],
  [
    "resource detail",
    AdminResourceDetailLoading,
    () => getResourceReleaseControlCopy("en").moderation,
  ],
  ["media", AdminResourceMediaLoading, () => resourceMediaCopy("en").title],
  ["requirements", AdminResourceRequirementsLoading, () => resourceRequirementsCopy("en").title],
  ["build", AdminResourceBuildLoading, () => getResourceBuildWorkspaceCopy("en").title],
  ["package", AdminResourceBuildPackageLoading, () => buildPackageCopy("en").inventory],
] as const)(
  "keeps the admin %s loading shell clipped without inventing results",
  async (_name, Loading, titleOf) => {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain(titleOf());
    expect(html).toContain('role="status"');
  },
);

it("keeps admin media loading copy honest while clipped", async () => {
  const copy = resourceMediaCopy("en");
  const admin = getDictionary("en").admin;
  const html = renderToStaticMarkup(await AdminResourceMediaLoading());
  expect(html).toContain(copy.title);
  expect(html).toContain(admin.loading);
  expect(html).toContain("overflow-x-clip");
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
  "keeps the leftover %s loading re-export clipped without inventing results",
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

it("keeps leftover admin support messages and report history loadings as clipped re-exports", () => {
  expect(read("site/src/app/admin/support/[id]/messages/loading.tsx")).toContain(
    'from "../../../../support/[id]/messages/loading"',
  );
  expect(read("site/src/app/admin/reports/[id]/history/loading.tsx")).toContain(
    'from "../../../../workspace/reports/[id]/history/loading"',
  );
  expectClippedLoadingSource(read("site/src/app/support/[id]/messages/loading.tsx"));
  expectClippedLoadingSource(read("site/src/app/workspace/reports/[id]/history/loading.tsx"));
});
