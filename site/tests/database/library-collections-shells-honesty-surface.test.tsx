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
vi.mock("../../src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("../../src/components/locale-context", () => ({
  useNexusLocale: () => ({ locale: state.locale }),
}));

import DiscussionsDetailLoading from "../../src/app/workspace/discussions/[id]/loading";
import FeedLoading from "../../src/app/workspace/feed/loading";
import CollectionAddLoading from "../../src/app/workspace/library/collections/[id]/add/loading";
import CollectionCompareLoading from "../../src/app/workspace/library/collections/[id]/compare/loading";
import CollectionCopyLoading from "../../src/app/workspace/library/collections/[id]/copy/loading";
import CollectionCopyItemsLoading from "../../src/app/workspace/library/collections/[id]/copy-items/loading";
import CollectionHistoryLoading from "../../src/app/workspace/library/collections/[id]/history/loading";
import CollectionDetailLoading from "../../src/app/workspace/library/collections/[id]/loading";
import CollectionMoveItemsLoading from "../../src/app/workspace/library/collections/[id]/move-items/loading";
import CollectionVersionsHistoryLoading from "../../src/app/workspace/library/collections/[id]/versions/history/loading";
import MembershipHistoryDetailLoading from "../../src/app/workspace/library/collections/membership-history/[id]/loading";
import { libraryCollectionComparisonCopy } from "../../src/lib/library-collection-comparison-i18n";
import { libraryCollectionsCopy } from "../../src/lib/library-collections-i18n";
import { publicationCopy } from "../../src/lib/publication-feed-copy";

beforeEach(() => {
  state.locale = "en";
});

const clippedPages = [
  "site/src/app/workspace/library/collections/page.tsx",
  "site/src/app/workspace/library/collections/membership-history/page.tsx",
  "site/src/app/workspace/library/collections/membership-history/[id]/page.tsx",
  "site/src/app/market/[slug]/page.tsx",
  "site/src/app/articles/page.tsx",
] as const;

const clippedLoadings = [
  "site/src/app/workspace/library/collections/[id]/loading.tsx",
  "site/src/app/workspace/library/collections/membership-history/[id]/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/add/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/copy/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/copy-items/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/move-items/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/compare/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/history/loading.tsx",
  "site/src/app/workspace/library/collections/[id]/versions/history/loading.tsx",
  "site/src/app/workspace/discussions/[id]/loading.tsx",
  "site/src/app/workspace/feed/loading.tsx",
] as const;

it("locks library collections shells and exclusive market/articles pages to clipped frames", () => {
  for (const page of clippedPages) {
    const source = read(page);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }
  for (const loading of clippedLoadings) {
    const source = read(loading);
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
  }
});

it("locks market detail and articles shells to ErrorState/EmptyState honesty chrome", () => {
  const market = read("site/src/app/market/[slug]/page.tsx");
  expect(market).toContain("ErrorState");
  expect(market).toContain("EmptyState");
  expect(market).toContain("pageShellClass");
  expect(market).toMatch(/min-h-11|size="touch"/u);
  expect(market).not.toContain('role="alert"');
  expect(market).not.toContain("throw error");

  const articles = read("site/src/app/articles/page.tsx");
  expect(articles).toContain("ErrorState");
  expect(articles).toContain("EmptyState");
  expect(articles).toContain("overflow-x-clip");
  expect(articles).toContain("min-w-0");
  expect(articles).toMatch(/min-h-11|size="touch"/u);

  expect(read("site/src/lib/i18n/en/product.ts")).toContain("detailUnavailableDescription");
  expect(read("site/src/lib/i18n/ru/product.ts")).toContain("noBuildsHint");
  expect(read("site/src/lib/i18n/en/product.ts")).toContain("noReviewsHint");
});

it.each([
  ["collection detail", CollectionDetailLoading, "library-collection-detail-loading-heading"],
  [
    "membership history detail",
    MembershipHistoryDetailLoading,
    "membership-history-detail-loading-heading",
  ],
  ["collection add", CollectionAddLoading, "collection-add-loading-heading"],
  ["collection copy", CollectionCopyLoading, "collection-copy-loading-heading"],
  ["collection copy-items", CollectionCopyItemsLoading, "collection-copy-items-loading-heading"],
  ["collection move-items", CollectionMoveItemsLoading, "collection-move-items-loading-heading"],
  ["collection compare", CollectionCompareLoading, "collection-compare-loading-heading"],
  ["collection history", CollectionHistoryLoading, "collection-history-loading-heading"],
  [
    "collection versions history",
    CollectionVersionsHistoryLoading,
    "collection-versions-history-loading-heading",
  ],
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
  "keeps the %s collection and feed loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const collections = libraryCollectionsCopy(locale);
    const compare = libraryCollectionComparisonCopy(locale);
    const feed = publicationCopy(locale);
    expect(renderToStaticMarkup(await CollectionDetailLoading())).toContain(collections.loading);
    expect(renderToStaticMarkup(await CollectionCompareLoading())).toContain(compare.loading);
    expect(renderToStaticMarkup(await CollectionAddLoading())).toContain(collections.add);
    expect(renderToStaticMarkup(await FeedLoading())).toContain(feed.loading);
    expect(renderToStaticMarkup(await FeedLoading())).toContain("overflow-x-clip");
    expect(renderToStaticMarkup(await DiscussionsDetailLoading())).toContain("overflow-x-clip");
  },
);
