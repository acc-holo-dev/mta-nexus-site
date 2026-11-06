import { AppError } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const h = vi.hoisted(() => ({
  actor: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en",
  releases: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/workspace/library/collections/lcol_a/releases",
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.actor },
}));
vi.mock("../apps/web/src/lib/services/library-collections-service", () => ({
  libraryCollectionsService: { releases: h.releases },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ productId, buildId }: { productId: string; buildId: string }) => (
    <button type="button" data-product={productId} data-build={buildId}>
      Download
    </button>
  ),
}));
vi.mock("../apps/web/src/components/library-release-follow-latest", () => ({
  LibraryReleaseFollowLatest: ({ productId }: { productId: string }) => (
    <button type="button" data-follow-latest={productId}>
      Use latest
    </button>
  ),
}));
vi.mock("../apps/web/src/components/resource-release-watch-control", () => ({
  ResourceReleaseWatchControl: ({
    watch,
  }: {
    watch: { productId: string; enabled: boolean };
  }) => (
    <button type="button" data-watch={watch.productId} data-enabled={String(watch.enabled)}>
      Watch
    </button>
  ),
}));

import { CollectionReleasesScreen } from "../apps/web/src/components/collection-releases-screen";
import { collectionReleasesCopy } from "../apps/web/src/lib/collection-releases-i18n";
import { libraryCollectionsCopy } from "../apps/web/src/lib/library-collections-i18n";

const item = {
  productId: "prd_a",
  hasAccess: true,
  title: "Safe & core",
  slug: "safe-core",
  state: "update_available",
  mode: "fixed",
  revision: 2,
  latestBuildId: "bld_new",
  latestVersion: "2.0.0",
  selectedBuildId: "bld_pin",
  selectedVersion: "1.0.0",
  addedAt: new Date(),
  watchEnabled: false,
  watchRevision: 0,
  watchUpdatedAt: null,
};
const report = () => ({
  collection: { id: "lcol_a", name: "Core & maps", status: "active", revision: 7 },
  generatedAt: "2026-10-12T00:00:00.000Z",
  itemCount: 200,
  items: [
    item,
    {
      ...item,
      productId: "prd_withdrawn",
      state: "selection_unavailable",
      selectedBuildId: null,
      selectedVersion: null,
    },
    {
      ...item,
      productId: "prd_lost",
      hasAccess: false,
      title: null,
      state: "unavailable",
      latestBuildId: null,
      latestVersion: null,
      selectedBuildId: null,
      selectedVersion: null,
    },
  ],
  counts: { all: 21, updates: 1, pinned: 3, unavailable: 2 },
  total: 21,
  page: 1,
  totalPages: 2,
  filter: "all",
  q: "core & maps",
});
const screen = async (values: Record<string, string | string[] | undefined> = {}) =>
  renderToStaticMarkup(
    await CollectionReleasesScreen({
      params: Promise.resolve({ id: "lcol_a" }),
      searchParams: Promise.resolve(values),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  h.actor = { id: "usr_a", role: "user" };
  h.locale = "en";
  h.releases.mockResolvedValue(report());
});
it.each(["en", "ru"])(
  "renders safe exact pinned downloads and masked references in %s",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain(
      locale === "ru" ? "Обзор выпусков коллекции" : "Collection release overview",
    );
    expect(html).toContain('data-build="bld_pin"');
    expect(html).not.toContain('data-build="bld_new"');
    expect(html).not.toContain('data-product="prd_withdrawn"');
    expect(html).not.toContain('data-product="prd_lost"');
    expect(html).not.toContain("/prd_lost/versions");
    expect(html).toContain("/prd_withdrawn/versions");
    expect(html).toContain("2.0.0");
    expect(html).toContain("1.0.0");
    expect(html).toContain(
      "/workspace/library/collections/resources?collectionId=lcol_a&amp;release=attention",
    );
    expect(html).toContain('href="/market/safe-core"');
    expect(html).toContain(
      'href="/workspace/library/prd_a/versions/compare?from=bld_pin&amp;to=bld_new"',
    );
    expect(html).toContain('data-follow-latest="prd_a"');
    expect(html).toContain('data-watch="prd_a"');
    expect(html).toContain('data-watch="prd_withdrawn"');
    expect(html).not.toContain('data-watch="prd_lost"');
  },
);
it("shows filtered empty releases with a clear link that keeps the collection path", async () => {
  const result = report();
  result.items = [];
  h.releases.mockResolvedValue(result);
  const html = await screen({ filter: "pinned", q: "missing" });
  const cc = libraryCollectionsCopy("en");
  expect(html).toContain(cc.emptyFilteredItems);
  expect(html).toContain("/lcol_a/releases");
  expect(html).toContain(cc.clear);
  expect(html).not.toContain(cc.emptyItems);
});
it("preserves filters/search in navigation and export while clear resets the search", async () => {
  const html = await screen({ q: "core & maps", filter: "all" });
  expect(html).toContain("page=2&amp;filter=all&amp;q=core+%26+maps");
  expect(html).toContain('/releases?filter=all"');
  expect(html).toContain("/releases/export?page=1&amp;filter=all&amp;q=core+%26+maps");
  expect(html).toContain("/lcol_a/versions?q=core+%26+maps");
  expect(html).toContain('dateTime="2026-10-12T00:00:00.000Z"');
  expect(html).toContain("border border-base bg-surface text-secondary");
});
it("keeps archived collections inspectable without batch mutation navigation", async () => {
  const result = report();
  result.collection.status = "archived";
  h.releases.mockResolvedValue(result);
  const html = await screen();
  expect(html).toContain("archived collection");
  expect(html).not.toContain("/lcol_a/versions?q=");
  expect(html).toContain('data-build="bld_pin"');
});
it("requires authentication, strict query controls and current ownership", async () => {
  h.actor = null;
  const guest = await screen();
  expect(guest).toContain(getDictionary("en").workspace.signInRequired);
  expect(guest).toContain("/auth/login?next=");
  expect(guest).toContain("%2Fworkspace%2Flibrary%2Fcollections%2Flcol_a%2Freleases");
  expect(h.releases).not.toHaveBeenCalled();
  h.actor = { id: "usr_a", role: "user" };
  for (const values of [{ userId: "other" }, { filter: ["all", "pinned"] }, { filter: "invalid" }])
    await expect(screen(values)).rejects.toThrow("NOT_FOUND");
  expect(h.releases).not.toHaveBeenCalled();
  h.releases.mockRejectedValueOnce(new AppError("Absent", 404, "NOT_FOUND"));
  await expect(screen()).rejects.toThrow("NOT_FOUND");
});
it("shows an honest recovery state when collection releases fail to load", async () => {
  h.releases.mockRejectedValueOnce(new Error("releases unavailable"));
  const copy = collectionReleasesCopy("en");
  const html = await screen();
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.loadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("/lcol_a/releases");
  expect(html).not.toContain("releases unavailable");
});
