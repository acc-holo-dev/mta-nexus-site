import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { inspectBuildPackage } from "../../src/lib/services/build-package-inspection";
import packageFixtures from "../fixtures/build-packages.json";

const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/resources/prd_a/builds/bld_a/package",
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../../src/lib/services/build-package-service", () => ({
  buildPackageService: { page: state.page },
}));

import { buildPackageSummary } from "@nexus/domain";
import AdminResourceBuildPackageLoading from "../../src/app/admin/resources/[id]/builds/[buildId]/package/loading";
import {
  BuildPackageEvidencePanel,
  BuildPackageSummaryPanel,
} from "../../src/components/build-package-evidence";
import { BuildPackageScreen } from "../../src/components/build-package-screen";
import { buildPackageCopy } from "../../src/lib/build-package-i18n";

const detail = {
  product: { id: "prd_a", title: "<Private title>" },
  build: { id: "bld_a", version: "2.0.0", hasInventory: true },
  baseline: { id: "bld_b", version: "1.0.0", hasInventory: true },
  candidates: [{ id: "bld_b", version: "1.0.0" }],
  comparisonAvailable: true,
  counts: [{ status: "changed", total: 23 }],
  files: [
    {
      path: "<script>.lua",
      status: "changed",
      beforeHash: "b".repeat(64),
      afterHash: "a".repeat(64),
      beforeSize: 0,
      afterSize: 2,
    },
  ],
  filter: "changed",
  page: 2,
  totalPages: 3,
  total: 23,
};
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a" };
  state.locale = "en";
  state.page.mockResolvedValue(detail);
});
it.each(["en", "ru"] as const)(
  "renders private comparison and bounded navigation in %s",
  async (locale) => {
    state.locale = locale;
    const html = renderToStaticMarkup(
      await BuildPackageScreen({
        productId: "prd_a",
        buildId: "bld_a",
        searchParams: Promise.resolve({ page: "2", filter: "changed", baseline: "bld_b" }),
      }),
    );
    expect(html).toContain(buildPackageCopy(locale).inventory);
    expect(html).toContain("&lt;Private title&gt;");
    expect(html).toContain("&lt;script&gt;.lua");
    expect(html).toContain("filter=changed");
    expect(html).toContain("page=3");
    expect(html).toContain("baseline=bld_b");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("storageKey");
  },
);
it("authenticates before any private query", async () => {
  state.actor = null;
  const html = renderToStaticMarkup(
    await BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(
    'href="/auth/login?next=%2Fworkspace%2Fresources%2Fprd_a%2Fbuilds%2Fbld_a%2Fpackage"',
  );
  expect(state.page).not.toHaveBeenCalled();
  expect(html).not.toContain("Private title");
});
it("fails closed on duplicate queries and current authority errors", async () => {
  await expect(
    BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      searchParams: Promise.resolve({ page: ["1", "2"] }),
    }),
  ).rejects.toThrow("NOT_FOUND");
  expect(state.page).not.toHaveBeenCalled();
  state.page.mockRejectedValue(new AppError("Private data", 403, "FORBIDDEN"));
  await expect(
    BuildPackageScreen({ productId: "prd_a", buildId: "bld_a", searchParams: Promise.resolve({}) }),
  ).rejects.toThrow("NOT_FOUND");
});
it("shows an honest recovery state when package inventory fails", async () => {
  state.page.mockRejectedValue(new Error("inventory unavailable"));
  const copy = buildPackageCopy("en");
  const html = renderToStaticMarkup(
    await BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      searchParams: Promise.resolve({ page: "2", filter: "changed", baseline: "bld_b" }),
    }),
  );
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("filter=changed");
  expect(html).toContain("baseline=bld_b");
  expect(html).not.toContain("Private title");
});
it("shows an honest staff recovery state without inventing package files", async () => {
  state.page.mockRejectedValue(new Error("inventory unavailable"));
  const copy = buildPackageCopy("en");
  const html = renderToStaticMarkup(
    await BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      staff: true,
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain('href="/admin/resources/prd_a/builds/bld_a/package"');
  expect(html).not.toContain("Private title");
});
it("clips honest loading shells on narrow layouts", async () => {
  const html = renderToStaticMarkup(await AdminResourceBuildPackageLoading());
  expect(html).toContain("min-w-0 max-w-5xl");
  expect(html).toContain("overflow-x-clip");
});
it("offers reset when a filtered inventory page has no files", async () => {
  state.page.mockResolvedValue({
    ...detail,
    files: [],
    filter: "changed",
    page: 1,
    totalPages: 1,
  });
  const html = renderToStaticMarkup(
    await BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      searchParams: Promise.resolve({ filter: "changed", baseline: "bld_b" }),
    }),
  );
  expect(html).toContain(buildPackageCopy("en").noFiles);
  expect(html).toContain(
    'href="/workspace/resources/prd_a/builds/bld_a/package?baseline=bld_b">Reset</a></div></div>',
  );
  expect(html).not.toContain("filter=changed");
});

it("makes legacy evidence uncertainty explicit and does not invent a delta", async () => {
  state.page.mockResolvedValue({
    ...detail,
    baseline: null,
    comparisonAvailable: false,
    filter: "all",
    counts: [{ status: "recorded", total: 1 }],
    files: [{ ...detail.files[0], status: "recorded", beforeHash: null }],
  });
  const html = renderToStaticMarkup(
    await BuildPackageScreen({
      productId: "prd_a",
      buildId: "bld_a",
      searchParams: Promise.resolve({}),
    }),
  );
  expect(html).toContain(buildPackageCopy("en").noBaseline);
  expect(html).toContain(buildPackageCopy("en").recorded);
  expect(html).not.toContain("b".repeat(64));
});
it.each(["en", "ru"] as const)(
  "keeps file paths private while displaying localized package evidence in %s",
  async (locale) => {
    const report = await inspectBuildPackage({
      bytes: Buffer.from(packageFixtures.stored, "base64"),
      format: "zip",
    });
    const publicHtml = renderToStaticMarkup(
      <BuildPackageSummaryPanel summary={buildPackageSummary(report)} locale={locale} />,
    );
    for (const privateString of ["demo/", "server.lua", "function.fetchRemote", "scoreboard"])
      expect(publicHtml).not.toContain(privateString);
    const privateHtml = renderToStaticMarkup(
      <BuildPackageEvidencePanel
        evidence={report}
        locale={locale}
        reportHref="/api/products/prd_a/builds/bld_a/package"
      />,
    );
    expect(privateHtml).toContain("function.fetchRemote");
    expect(privateHtml).toContain("missing.png");
    expect(privateHtml).toContain(buildPackageCopy(locale).note);
    expect(privateHtml).toContain(buildPackageCopy(locale).export);
    expect(privateHtml).not.toContain("storageKey");
  },
);
