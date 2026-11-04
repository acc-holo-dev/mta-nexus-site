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
vi.mock("../apps/web/src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));

import RequirementsLoading from "../apps/web/src/app/workspace/library/[id]/requirements/loading";
import VersionsLoading from "../apps/web/src/app/workspace/library/[id]/versions/loading";
import ReviewDetailLoading from "../apps/web/src/app/workspace/library/review/[id]/loading";
import ReviewsLoading from "../apps/web/src/app/workspace/library/reviews/loading";
import WatchHistoryLoading from "../apps/web/src/app/workspace/library/watches/history/loading";
import WatchesLoading from "../apps/web/src/app/workspace/library/watches/loading";
import { getResourceReleaseControlCopy } from "../apps/web/src/lib/resource-release-control-i18n";
import { resourceReleaseWatchHistoryCopy } from "../apps/web/src/lib/resource-release-watch-history-i18n";
import { resourceReleaseWatchesCopy } from "../apps/web/src/lib/resource-release-watches-i18n";
import { resourceRequirementsCopy } from "../apps/web/src/lib/resource-requirements-i18n";
import { resourceReviewCopy } from "../apps/web/src/lib/resource-review-i18n";

beforeEach(() => {
  state.locale = "en";
});

it.each([
  ["watches", WatchesLoading, "release-watches-loading-heading"],
  ["watch history", WatchHistoryLoading, "release-watch-history-loading-heading"],
  ["reviews", ReviewsLoading, "library-reviews-loading-heading"],
  ["review detail", ReviewDetailLoading, "library-review-loading-heading"],
  ["versions", VersionsLoading, "library-versions-loading-heading"],
  ["requirements", RequirementsLoading, "library-requirements-loading-heading"],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingId) => {
    state.locale = "en";
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`id="${headingId}"`);
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
    expect(html).toContain('role="status"');
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s watches and history loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const watches = resourceReleaseWatchesCopy(locale);
    const history = resourceReleaseWatchHistoryCopy(locale);
    const reviews = resourceReviewCopy(locale);
    const versions = getResourceReleaseControlCopy(locale);
    const requirements = resourceRequirementsCopy(locale);
    expect(renderToStaticMarkup(await WatchesLoading())).toContain(watches.loading);
    expect(renderToStaticMarkup(await WatchHistoryLoading())).toContain(history.loading);
    expect(renderToStaticMarkup(await ReviewsLoading())).toContain(reviews.pageLoading);
    expect(renderToStaticMarkup(await ReviewDetailLoading())).toContain(reviews.pageLoading);
    expect(renderToStaticMarkup(await VersionsLoading())).toContain(versions.updatesLoading);
    expect(renderToStaticMarkup(await RequirementsLoading())).toContain(requirements.loading);
  },
);

it("locks library watches honesty page sources to ErrorState/EmptyState chrome", () => {
  const pages = [
    "apps/web/src/app/workspace/library/watches/page.tsx",
    "apps/web/src/app/workspace/library/watches/history/page.tsx",
    "apps/web/src/app/workspace/library/reviews/page.tsx",
    "apps/web/src/app/workspace/library/review/[id]/page.tsx",
    "apps/web/src/app/workspace/library/[id]/versions/page.tsx",
  ];
  for (const page of pages) {
    const source = read(page);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('role="alert"');
  }
  expect(read("apps/web/src/app/workspace/library/watches/page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/app/workspace/library/watches/history/page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("apps/web/src/app/workspace/library/reviews/page.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/app/workspace/library/[id]/versions/page.tsx")).toContain("EmptyState");
  for (const loading of [
    "apps/web/src/app/workspace/library/watches/loading.tsx",
    "apps/web/src/app/workspace/library/watches/history/loading.tsx",
    "apps/web/src/app/workspace/library/reviews/loading.tsx",
    "apps/web/src/app/workspace/library/review/[id]/loading.tsx",
    "apps/web/src/app/workspace/library/[id]/versions/loading.tsx",
    "apps/web/src/app/workspace/library/[id]/requirements/loading.tsx",
  ]) {
    expect(read(loading)).toContain("overflow-x-clip");
    expect(read(loading)).toContain("min-w-0");
  }
  expect(read("apps/web/src/lib/resource-release-watches-i18n.ts")).toContain(
    "loadUnavailableDescription",
  );
  expect(read("apps/web/src/lib/resource-release-watch-history-i18n.ts")).toContain("emptyHint");
  expect(read("apps/web/src/lib/resource-review-i18n.ts")).toContain("ownEmptyHint");
  expect(read("apps/web/src/lib/resource-release-control-i18n.ts")).toContain(
    "versionsLoadUnavailable",
  );
});
