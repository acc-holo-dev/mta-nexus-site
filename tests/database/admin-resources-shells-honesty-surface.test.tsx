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
vi.mock("../../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));

import AdminReportHistoryLoading from "../../apps/web/src/app/admin/reports/[id]/history/loading";
import AdminResourceBuildLoading from "../../apps/web/src/app/admin/resources/[id]/builds/[buildId]/loading";
import AdminResourceBuildPackageLoading from "../../apps/web/src/app/admin/resources/[id]/builds/[buildId]/package/loading";
import AdminResourceDetailLoading from "../../apps/web/src/app/admin/resources/[id]/loading";
import AdminResourceMediaLoading from "../../apps/web/src/app/admin/resources/[id]/media/loading";
import AdminResourceRequirementsLoading from "../../apps/web/src/app/admin/resources/[id]/requirements/loading";
import AdminResourcesLoading from "../../apps/web/src/app/admin/resources/loading";
import AdminSupportMessagesLoading from "../../apps/web/src/app/admin/support/[id]/messages/loading";
import { buildPackageCopy } from "../../apps/web/src/lib/build-package-i18n";
import { reportHistoryCopy } from "../../apps/web/src/lib/community-report-history-copy";
import { getDictionary } from "../../apps/web/src/lib/i18n";
import { getResourceBuildWorkspaceCopy } from "../../apps/web/src/lib/resource-build-workspace-i18n";
import { resourceMediaCopy } from "../../apps/web/src/lib/resource-media-i18n";
import { getResourceReleaseControlCopy } from "../../apps/web/src/lib/resource-release-control-i18n";
import { resourceRequirementsCopy } from "../../apps/web/src/lib/resource-requirements-i18n";
import { supportMessageCopy } from "../../apps/web/src/lib/support-message-discovery-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedShellPages = [
  "apps/web/src/app/admin/resources/[id]/media/page.tsx",
  "apps/web/src/app/admin/resources/[id]/requirements/page.tsx",
  "apps/web/src/app/admin/resources/[id]/builds/[buildId]/page.tsx",
  "apps/web/src/app/admin/resources/[id]/builds/[buildId]/package/page.tsx",
] as const;

const clippedResourceLoadings = [
  "apps/web/src/app/admin/resources/loading.tsx",
  "apps/web/src/app/admin/resources/[id]/loading.tsx",
  "apps/web/src/app/admin/resources/[id]/media/loading.tsx",
  "apps/web/src/app/admin/resources/[id]/requirements/loading.tsx",
  "apps/web/src/app/admin/resources/[id]/builds/[buildId]/loading.tsx",
  "apps/web/src/app/admin/resources/[id]/builds/[buildId]/package/loading.tsx",
] as const;

it("locks admin resource route shells to clipped min-w-0 frames", () => {
  for (const page of clippedShellPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("locks sibling admin resource loadings to clipped busy frames", () => {
  for (const loading of clippedResourceLoadings) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
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
