import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import packageFixtures from "./fixtures/build-packages.json";
import { inspectBuildPackage } from "../apps/web/src/lib/services/build-package-inspection";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NOT_FOUND");
  },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/services/build-package-service", () => ({
  buildPackageService: { page: state.page },
}));
import { BuildPackageScreen } from "../apps/web/src/components/build-package-screen";
import {
  BuildPackageEvidencePanel,
  BuildPackageSummaryPanel,
} from "../apps/web/src/components/build-package-evidence";
import { buildPackageSummary } from "@nexus/domain";
import { buildPackageCopy } from "../apps/web/src/lib/build-package-i18n";
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
  expect(html).toContain("/auth/login");
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
