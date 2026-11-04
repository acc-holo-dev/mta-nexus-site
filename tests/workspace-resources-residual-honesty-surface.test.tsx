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

import BuildLoading from "../apps/web/src/app/workspace/resources/[id]/builds/[buildId]/loading";
import PackageLoading from "../apps/web/src/app/workspace/resources/[id]/builds/[buildId]/package/loading";
import CompatibilityLoading from "../apps/web/src/app/workspace/resources/[id]/compatibility/loading";
import MediaLoading from "../apps/web/src/app/workspace/resources/[id]/media/loading";
import RequirementsLoading from "../apps/web/src/app/workspace/resources/[id]/requirements/loading";
import ResourcesLoading from "../apps/web/src/app/workspace/resources/loading";
import NewResourceLoading from "../apps/web/src/app/workspace/resources/new/loading";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { getResourceManagementCopy } from "../apps/web/src/lib/resource-management-i18n";

beforeEach(() => {
  state.locale = "en";
});

it.each([
  ["resources", ResourcesLoading, "author-resources-loading-heading"],
  ["new", NewResourceLoading, "new-resource-loading-heading"],
  ["media", MediaLoading, "resource-media-loading-heading"],
  ["compatibility", CompatibilityLoading, "resource-compatibility-loading-heading"],
  ["requirements", RequirementsLoading, "resource-requirements-loading-heading"],
  ["build", BuildLoading, "resource-build-loading-heading"],
  ["package", PackageLoading, "resource-build-package-loading-heading"],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingId) => {
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`id="${headingId}"`);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('role="status"');
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s resources loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = getDictionary(locale).authorResources;
    const html = renderToStaticMarkup(await ResourcesLoading());
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.loading);
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks residual resources page sources to ErrorState/EmptyState honesty chrome", () => {
  const inventory = read("apps/web/src/app/workspace/resources/page.tsx");
  expect(inventory).toContain("ErrorState");
  expect(inventory).toContain("EmptyState");
  expect(inventory).toContain("overflow-x-clip");
  expect(inventory).toContain("min-w-0");
  expect(inventory).toContain("min-h-11");
  expect(inventory).toContain("loadUnavailableHint");
  expect(inventory).toContain("emptyHint");
  expect(inventory).toContain("emptyFilterHint");
  expect(inventory).not.toContain('role="alert"');

  const compatibility = read("apps/web/src/app/workspace/resources/[id]/compatibility/page.tsx");
  expect(compatibility).toContain("ErrorState");
  expect(compatibility).toContain("overflow-x-clip");
  expect(compatibility).toContain("min-w-0");
  expect(compatibility).toContain("min-h-11");
  expect(compatibility).toContain("loadUnavailableHint");
  expect(compatibility).not.toContain('role="alert"');

  const clippedDelegates = [
    "apps/web/src/app/workspace/resources/new/page.tsx",
    "apps/web/src/app/workspace/resources/[id]/media/page.tsx",
    "apps/web/src/app/workspace/resources/[id]/requirements/page.tsx",
    "apps/web/src/app/workspace/resources/[id]/builds/[buildId]/page.tsx",
    "apps/web/src/app/workspace/resources/[id]/builds/[buildId]/package/page.tsx",
  ];
  for (const page of clippedDelegates) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }

  const loadings = [
    "apps/web/src/app/workspace/resources/loading.tsx",
    "apps/web/src/app/workspace/resources/new/loading.tsx",
    "apps/web/src/app/workspace/resources/[id]/media/loading.tsx",
    "apps/web/src/app/workspace/resources/[id]/compatibility/loading.tsx",
    "apps/web/src/app/workspace/resources/[id]/requirements/loading.tsx",
    "apps/web/src/app/workspace/resources/[id]/builds/[buildId]/loading.tsx",
    "apps/web/src/app/workspace/resources/[id]/builds/[buildId]/package/loading.tsx",
  ];
  for (const loading of loadings) {
    expect(read(loading)).toContain("overflow-x-clip");
    expect(read(loading)).toContain("min-w-0");
  }

  expect(read("apps/web/src/lib/i18n/en/workspace.ts")).toContain("loadUnavailableHint");
  expect(read("apps/web/src/lib/i18n/ru/workspace.ts")).toContain("emptyFilterHint");
  expect(getResourceManagementCopy("en").loadUnavailableHint.length).toBeGreaterThan(0);
  expect(getResourceManagementCopy("ru").loadUnavailableHint.length).toBeGreaterThan(0);
});
