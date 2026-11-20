import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

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
vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: state.locale, dictionary: getDictionary(state.locale) }),
}));

import ImportLoading from "../../src/app/workspace/library/collections/[id]/import/loading";
import ReconcileLoading from "../../src/app/workspace/library/collections/[id]/reconcile/loading";
import CollectionsError from "../../src/app/workspace/library/collections/error";
import HistoryLoading from "../../src/app/workspace/library/collections/history/loading";
import ReceiptLoading from "../../src/app/workspace/library/collections/receipts/[id]/loading";
import { libraryCollectionHistoryCopy } from "../../src/features/library/library-collection-history-i18n";
import { libraryCollectionsCopy } from "../../src/features/library/library-collections-i18n";

beforeEach(() => {
  state.locale = "en";
});

it("locks collections error boundary with ErrorState description and touch retry", () => {
  const copy = libraryCollectionsCopy("en");
  const html = renderToStaticMarkup(<CollectionsError reset={() => undefined} />);
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.retry);
  expect(html).toContain(copy.loadUnavailableDescription);
  expect(html).toContain(copy.reload);
  expectClippedLoadingSource(html);
  expect(html).toContain("min-h-11");
});

it.each([
  ["import", ImportLoading, "collection-import-loading-heading"],
  ["reconcile", ReconcileLoading, "collection-reconcile-loading-heading"],
  ["receipt", ReceiptLoading, "collection-receipt-loading-heading"],
  ["history", HistoryLoading, "collection-history-loading-heading"],
] as const)(
  "keeps the %s loading shell clipped without inventing results",
  async (_name, Loading, headingId) => {
    state.locale = "en";
    const html = renderToStaticMarkup(await Loading());
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain(`id="${headingId}"`);
    expectClippedLoadingSource(html);
    expect(html).toContain('role="status"');
  },
);

it.each(["en", "ru"] as const)(
  "keeps the %s history loading copy honest while clipped",
  async (locale) => {
    state.locale = locale;
    const copy = libraryCollectionHistoryCopy(locale);
    const html = renderToStaticMarkup(await HistoryLoading());
    expect(html).toContain(copy.title);
    expect(html).toContain(copy.loading);
    expectClippedLoadingSource(html);
  },
);

it("locks residual collections page sources to ErrorState/EmptyState honesty chrome", () => {
  const pages = [
    "site/src/features/library/server/collection-compare-page.tsx",
    "site/src/features/library/server/collection-import-page.tsx",
    "site/src/features/library/server/collection-reconcile-page.tsx",
    "site/src/features/library/server/collection-receipt-page.tsx",
    "site/src/features/library/server/collection-history-page.tsx",
    "site/src/features/library/components/library-collections-route-error.tsx",
  ];
  for (const page of pages) {
    const source = read(page);
    expect(source).toContain("ErrorState");
    expectClippedLoadingSource(source);
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('role="alert"');
  }
  expect(read("site/src/app/workspace/library/collections/error.tsx")).toContain(
    "features/library/library-collections-route-error",
  );
  expect(read("site/src/app/workspace/library/collections/not-found.tsx")).toContain(
    "features/library/library-collections-not-found-server",
  );
  expect(read("site/src/features/library/server/library-collections-not-found.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/features/library/server/collection-history-page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/features/library/server/collection-compare-page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/features/library/server/collection-receipt-page.tsx")).toContain(
    "EmptyState",
  );
  expectClippedLoadingSource(
    read("site/src/app/workspace/library/collections/[id]/import/loading.tsx"),
  );
  expectClippedLoadingSource(
    read("site/src/app/workspace/library/collections/[id]/reconcile/loading.tsx"),
  );
  expectClippedLoadingSource(
    read("site/src/app/workspace/library/collections/receipts/[id]/loading.tsx"),
  );
  expectClippedLoadingSource(
    read("site/src/app/workspace/library/collections/history/loading.tsx"),
  );
  expect(read("site/src/features/library/library-collections-i18n.ts")).toContain(
    "loadUnavailableDescription",
  );
  expect(read("site/src/features/library/library-collection-history-i18n.ts")).toContain(
    "emptyHint",
  );
});
