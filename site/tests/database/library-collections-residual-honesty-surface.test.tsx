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

import ImportLoading from "../../src/app/workspace/library/collections/[id]/import/loading";
import ReconcileLoading from "../../src/app/workspace/library/collections/[id]/reconcile/loading";
import CollectionsError from "../../src/app/workspace/library/collections/error";
import HistoryLoading from "../../src/app/workspace/library/collections/history/loading";
import ReceiptLoading from "../../src/app/workspace/library/collections/receipts/[id]/loading";
import { libraryCollectionHistoryCopy } from "../../src/lib/library-collection-history-i18n";
import { libraryCollectionsCopy } from "../../src/lib/library-collections-i18n";

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
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("min-w-0");
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
    expect(html).toContain("overflow-x-clip");
    expect(html).toContain("min-w-0");
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
    expect(html).toContain("overflow-x-clip");
  },
);

it("locks residual collections page sources to ErrorState/EmptyState honesty chrome", () => {
  const pages = [
    "site/src/app/workspace/library/collections/[id]/compare/page.tsx",
    "site/src/app/workspace/library/collections/[id]/import/page.tsx",
    "site/src/app/workspace/library/collections/[id]/reconcile/page.tsx",
    "site/src/app/workspace/library/collections/receipts/[id]/page.tsx",
    "site/src/app/workspace/library/collections/history/page.tsx",
    "site/src/app/workspace/library/collections/error.tsx",
  ];
  for (const page of pages) {
    const source = read(page);
    expect(source).toContain("ErrorState");
    expect(source).toContain("overflow-x-clip");
    expect(source).toContain("min-w-0");
    expect(source).toMatch(/min-h-11|size="touch"/u);
    expect(source).not.toContain('role="alert"');
  }
  expect(read("site/src/app/workspace/library/collections/history/page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/app/workspace/library/collections/[id]/compare/page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/app/workspace/library/collections/receipts/[id]/page.tsx")).toContain(
    "EmptyState",
  );
  expect(read("site/src/app/workspace/library/collections/[id]/import/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/app/workspace/library/collections/[id]/reconcile/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/app/workspace/library/collections/receipts/[id]/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/app/workspace/library/collections/history/loading.tsx")).toContain(
    "overflow-x-clip",
  );
  expect(read("site/src/lib/library-collections-i18n.ts")).toContain("loadUnavailableDescription");
  expect(read("site/src/lib/library-collection-history-i18n.ts")).toContain("emptyHint");
});
