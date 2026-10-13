import { AppError } from "@nexus/domain";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  history: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { inventory: state.history },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({
    productId,
    buildId,
    version,
  }: {
    productId: string;
    buildId: string;
    version: string;
  }) => (
    <button type="button" data-product={productId} data-build={buildId}>
      {version}
    </button>
  ),
}));

import Page, {
  dynamic,
  generateMetadata,
} from "../apps/web/src/app/workspace/library/collections/resources/page";
import { libraryCollectionInventoryCopy } from "../apps/web/src/lib/library-collection-inventory-i18n";
const date = "2026-10-13T00:00:00.000Z",
  a = { id: "lcol_a", name: "Own <active>", status: "active", revision: 4, itemCount: 2 },
  b = { id: "lcol_b", name: "Own archived", status: "archived", revision: 7, itemCount: 1 };
const report = () => ({
  schemaVersion: 1,
  generatedAt: date,
  page: 2,
  status: "active",
  filter: "shared",
  release: "updates",
  q: "%_",
  collectionId: "lcol_a",
  collections: [a, b],
  counts: { resources: 41, references: 42, available: 40, unavailable: 1, shared: 1 },
  releaseCounts: { latest: 39, pinned: 1, updates: 1, selectionUnavailable: 0, attention: 2 },
  pageSize: 20,
  total: 41,
  totalPages: 3,
  items: [
    {
      productId: "prd_a",
      title: "Accessible & title",
      available: true,
      release: {
        state: "update_available",
        mode: "fixed",
        revision: 2,
        canReviewRequirements: true,
        latest: { buildId: "bld_new", version: "2.0.0" },
        effective: { buildId: "bld_pin", version: "1.0.0" },
      },
      memberships: [
        { ...a, addedAt: date },
        { ...b, addedAt: date },
      ],
    },
    {
      productId: "prd_orphan",
      title: "PRIVATE-TITLE",
      available: false,
      memberships: [{ ...a, addedAt: date }],
    },
  ],
});
const values = {
  page: "2",
  status: "active",
  filter: "shared",
  q: "%_",
  collectionId: "lcol_a",
  release: "updates",
};
function availableItem() {
  const item = report().items[0];
  if (!item?.release) throw Error("Missing release fixture");
  return { ...item, release: item.release };
}
const screen = async (query: Record<string, string | string[] | undefined> = values) =>
  renderToStaticMarkup(await Page({ searchParams: Promise.resolve(query) }));
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.history.mockResolvedValue(report());
});
it.each(["en", "ru"] as const)(
  "renders full memberships, masked labels, safe links and preserved filters in %s",
  async (locale) => {
    state.locale = locale;
    const html = await screen(),
      v = libraryCollectionInventoryCopy(locale);
    expect(html).toContain(v.title);
    expect(html).toContain(v.note);
    expect(html).toContain("Accessible &amp; title");
    expect(html).toContain("Own &lt;active&gt;");
    expect(html).toContain("Own archived");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain("/workspace/library/prd_a/collections");
    expect(html).toContain("/workspace/library/prd_orphan/collections");
    expect(html).toContain("/workspace/library/prd_a/versions");
    expect(html).toContain('data-product="prd_a" data-build="bld_pin"');
    expect(html).not.toContain('data-build="bld_new"');
    expect(html).toContain("/prd_a/requirements?previewBuildId=bld_pin");
    expect(html).toContain("/prd_a/versions/compare?from=bld_pin&amp;to=bld_new");
    expect(html).toContain(v.releaseStates.update_available);
    expect(html).toContain(v.snapshotNote);
    expect(html).not.toContain("/workspace/library/prd_orphan/versions");
    expect(html).not.toContain("/download");
    expect(html).toContain("/workspace/library/collections/lcol_a/compare?to=lcol_b");
    expect(html).toContain("/api/library/collections/resources/export?");
    expect(html).toContain(
      "page=1&amp;status=active&amp;filter=shared&amp;q=%25_&amp;collectionId=lcol_a&amp;release=updates",
    );
    expect(html).toContain(
      "page=3&amp;status=active&amp;filter=shared&amp;q=%25_&amp;collectionId=lcol_a&amp;release=updates",
    );
    expect(state.history).toHaveBeenCalledWith(state.actor, {
      page: 2,
      status: "active",
      filter: "shared",
      q: "%_",
      collectionId: "lcol_a",
      release: "updates",
    });
    expect(dynamic).toBe("force-dynamic");
    expect(await generateMetadata()).toEqual({
      title: `${v.title} | MTA NEXUS`,
      robots: { index: false, follow: false },
    });
  },
);
it("authenticates before query parsing or reference lookup", async () => {
  state.actor = null;
  expect(await screen({ userId: "other" })).toContain("Sign in");
  expect(state.history).not.toHaveBeenCalled();
});
it.each([
  { userId: "other" },
  { page: ["1", "2"] },
  { filter: "ready" },
  { collectionId: "../private" },
  { q: "a\u0000" },
])("rejects invalid or ambiguous query %o", async (query) => {
  expect(await screen(query)).toContain('role="alert"');
  expect(state.history).not.toHaveBeenCalled();
});
it("shows empty results and masks absent/foreign collection scopes", async () => {
  state.history.mockResolvedValue({ ...report(), items: [], total: 0, page: 1, totalPages: 1 });
  expect(await screen()).toContain(libraryCollectionInventoryCopy("en").empty);
  state.history.mockRejectedValue(new AppError("PRIVATE", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NEXT_NOT_FOUND");
});
it("keeps a missing pinned choice inspectable without comparison, preparation or fallback download", async () => {
  const result = report();
  state.history.mockResolvedValue({
    ...result,
    items: [
      {
        ...availableItem(),
        release: { ...availableItem().release, state: "selection_unavailable", effective: null },
      },
    ],
  });
  const html = await screen();
  expect(html).toContain(libraryCollectionInventoryCopy("en").selectionMissing);
  expect(html).toContain("/prd_a/versions");
  expect(html).not.toContain("data-build=");
  expect(html).not.toContain("/versions/compare?");
  expect(html).not.toContain("/requirements?");
});
it("withholds release metadata and controls for lost access even if malformed transport includes a release", async () => {
  const result = report();
  result.items = [{ ...availableItem(), available: false }];
  state.history.mockResolvedValue(result);
  const html = await screen();
  expect(html).not.toContain("bld_pin");
  expect(html).not.toContain("bld_new");
  expect(html).not.toContain("1.0.0");
  expect(html).not.toContain("/requirements?");
  expect(html).toContain("/prd_a/collections");
});
it("does not link an unsupported paid requirements report while retaining exact build review and download", async () => {
  const result = report();
  state.history.mockResolvedValue({
    ...result,
    items: [
      {
        ...availableItem(),
        release: { ...availableItem().release, canReviewRequirements: false },
      },
    ],
  });
  const html = await screen();
  expect(html).not.toContain("/requirements?");
  expect(html).toContain("/versions/compare?from=bld_pin&amp;to=bld_new");
  expect(html).toContain('data-build="bld_pin"');
});
