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
import CompareLoading from "../apps/web/src/app/workspace/library/[id]/versions/compare/loading";
import CollectionAddLoading from "../apps/web/src/app/workspace/library/collections/[id]/add/loading";
import CollectionCopyLoading from "../apps/web/src/app/workspace/library/collections/[id]/copy/loading";
import CollectionCopyItemsLoading from "../apps/web/src/app/workspace/library/collections/[id]/copy-items/loading";
import CollectionHistoryLoading from "../apps/web/src/app/workspace/library/collections/[id]/history/loading";
import CollectionDetailLoading from "../apps/web/src/app/workspace/library/collections/[id]/loading";
import CollectionMoveItemsLoading from "../apps/web/src/app/workspace/library/collections/[id]/move-items/loading";
import CollectionReleasesLoading from "../apps/web/src/app/workspace/library/collections/[id]/releases/loading";
import CollectionRequirementsLoading from "../apps/web/src/app/workspace/library/collections/[id]/requirements/loading";
import CollectionVersionsHistoryLoading from "../apps/web/src/app/workspace/library/collections/[id]/versions/history/loading";
import CollectionVersionsLoading from "../apps/web/src/app/workspace/library/collections/[id]/versions/loading";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";
import { resourceRequirementsCopy } from "../apps/web/src/lib/resource-requirements-i18n";

beforeEach(() => {
  state.locale = "en";
});

const clippedDetailPages = [
  "apps/web/src/app/workspace/library/collections/[id]/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/add/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/copy/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/copy-items/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/move-items/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/history/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/releases/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/requirements/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/versions/page.tsx",
  "apps/web/src/app/workspace/library/collections/[id]/versions/history/page.tsx",
  "apps/web/src/app/workspace/library/[id]/requirements/page.tsx",
  "apps/web/src/app/workspace/library/[id]/versions/compare/page.tsx",
] as const;

const delegatedHonestyScreens = [
  "apps/web/src/components/collection-releases-screen.tsx",
  "apps/web/src/components/collection-requirements-screen.tsx",
  "apps/web/src/components/library-selection-batch-screen.tsx",
  "apps/web/src/components/resource-requirements-screen.tsx",
  "apps/web/src/components/library-release-comparison-screen.tsx",
] as const;

it("locks library collection detail route shells to clipped min-w-0 frames", () => {
  for (const page of clippedDetailPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toContain("pageShellClass");
  }
});

it("locks delegated collection detail screens to ErrorState recovery and touch CTAs", () => {
  for (const screen of delegatedHonestyScreens) {
    const source = read(screen);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('role="alert"');
  }
  expect(read("apps/web/src/components/collection-releases-screen.tsx")).toContain("EmptyState");
  expect(read("apps/web/src/components/collection-requirements-screen.tsx")).toContain(
    "EmptyState",
  );
  expect(read("apps/web/src/components/library-selection-batch-screen.tsx")).toContain(
    "EmptyState",
  );
});

it.each([
  ["collection detail", CollectionDetailLoading, "library-collection-detail-loading-heading"],
  ["collection add", CollectionAddLoading, "collection-add-loading-heading"],
  ["collection copy", CollectionCopyLoading, "collection-copy-loading-heading"],
  ["collection copy-items", CollectionCopyItemsLoading, "collection-copy-items-loading-heading"],
  ["collection move-items", CollectionMoveItemsLoading, "collection-move-items-loading-heading"],
  ["collection history", CollectionHistoryLoading, "collection-history-loading-heading"],
  ["collection releases", CollectionReleasesLoading, "collection-releases-loading-heading"],
  [
    "collection requirements",
    CollectionRequirementsLoading,
    "collection-requirements-loading-heading",
  ],
  ["collection versions", CollectionVersionsLoading, "collection-versions-loading-heading"],
  [
    "collection versions history",
    CollectionVersionsHistoryLoading,
    "collection-versions-history-loading-heading",
  ],
  ["library requirements", RequirementsLoading, "library-requirements-loading-heading"],
  ["library release compare", CompareLoading, "library-versions-compare-loading-heading"],
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
  "keeps the %s collection detail loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const collections = libraryCollectionsCopy(locale);
    const resourceRequirements = resourceRequirementsCopy(locale);
    const workspace = getDictionary(locale).workspace;
    expect(renderToStaticMarkup(await CollectionDetailLoading())).toContain(collections.loading);
    expect(renderToStaticMarkup(await CollectionAddLoading())).toContain(collections.add);
    expect(renderToStaticMarkup(await CollectionReleasesLoading())).toContain(collections.items);
    expect(renderToStaticMarkup(await CollectionRequirementsLoading())).toContain(
      collections.items,
    );
    expect(renderToStaticMarkup(await CollectionVersionsLoading())).toContain(collections.versions);
    expect(renderToStaticMarkup(await RequirementsLoading())).toContain(
      resourceRequirements.loading,
    );
    expect(renderToStaticMarkup(await CompareLoading())).toContain(workspace.libraryTitle);
    expect(renderToStaticMarkup(await CompareLoading())).toContain(workspace.loading);
    expect(renderToStaticMarkup(await CompareLoading())).toContain("overflow-x-clip");
  },
);
