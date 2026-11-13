import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  updates: vi.fn(),
  versions: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  usePathname: () => "/workspace/library/updates",
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children: ReactNode }) =>
      React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../site/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../site/src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: {
    detail: async (_user: unknown, productId: string) => ({
      productId,
      revision: 0,
      enabled: false,
      updatedAt: null,
    }),
  },
}));
vi.mock("../site/src/components/resource-release-watch-control", () => ({
  ResourceReleaseWatchControl: () => <span>Release watch</span>,
}));
vi.mock("../site/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../site/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { page: state.updates, detail: state.versions },
}));
vi.mock("../site/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ buildId }: { buildId?: string }) => (
    <button type="button" data-download={buildId}>
      Download
    </button>
  ),
}));
vi.mock("../site/src/components/library-release-selection-controls", () => ({
  LibraryReleaseSelectionControls: ({
    revision,
    versions,
  }: {
    revision: number;
    versions: unknown;
  }) => (
    <span data-revision={revision} data-choices={JSON.stringify(versions)}>
      Preference
    </span>
  ),
}));
vi.mock("../site/src/components/library-release-follow-latest", () => ({
  LibraryReleaseFollowLatest: ({
    productId,
    revision,
  }: {
    productId: string;
    revision: number;
  }) => (
    <button type="button" data-follow-latest={productId} data-revision={revision}>
      Use latest
    </button>
  ),
}));
vi.mock("../site/src/components/resource-release-watch-control", () => ({
  ResourceReleaseWatchControl: ({
    watch,
  }: {
    watch: { productId: string; enabled: boolean; revision: number };
  }) => (
    <button type="button" data-watch={watch.productId} data-enabled={String(watch.enabled)}>
      Watch
    </button>
  ),
}));

import Versions from "../site/src/app/workspace/library/[id]/versions/page";
import Updates, { metadata } from "../site/src/app/workspace/library/updates/page";
import { getResourceReleaseControlCopy } from "../site/src/lib/resource-release-control-i18n";

const input = {
  params: Promise.resolve({ id: "prd_a" }),
  searchParams: Promise.resolve({ page: "2" }),
};
const now = new Date("2026-10-10T12:00:00.000Z"),
  bounds = { page: 2, totalPages: 3, pageSize: 20, total: 41 };
beforeEach(() => {
  vi.clearAllMocks();
  state.user = { id: "usr_a", role: "user" };
  state.locale = "en";
  state.updates.mockReset().mockResolvedValue({
    items: [
      {
        productId: "prd_a",
        title: "<Resource>",
        state: "selection_unavailable",
        mode: "fixed",
        selectedVersion: null,
        selectedBuildId: null,
        latestVersion: "2.0.0",
        latestBuildId: "bld_latest",
        storageKey: "PRIVATE-FILE",
        watchEnabled: false,
        watchRevision: 0,
        watchUpdatedAt: null,
        hasAccess: true,
      },
    ],
    counts: { all: 41, updates: 1, pinned: 1, unavailable: 1 },
    ...bounds,
  });
  state.versions.mockReset().mockResolvedValue({
    product: { id: "prd_a", title: "<Resource>" },
    selection: { revision: 3, mode: "fixed", buildId: "withdrawn" },
    selected: null,
    latest: {
      id: "bld_latest",
      version: "2.0.0",
      status: "published",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 100,
      fileName: "latest.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: now,
      mtaVersionTarget: "1.6.0",
      isSigned: false,
      createdAt: now,
    },
    versions: [
      {
        id: "bld_latest",
        version: "2.0.0",
        releaseNotes: "<script>unsafe text</script>",
        status: "published",
        sha256Hash: "a".repeat(64),
        fileSizeBytes: 100,
        fileName: "latest.zip",
        mimeType: "application/zip",
        scanStatus: "clean",
        scanner: "clamav",
        scannedAt: now,
        mtaVersionTarget: "1.6.0",
        isSigned: false,
        createdAt: now,
        storageKey: "PRIVATE-FILE",
      },
    ],
    ...bounds,
  });
});
it("distinguishes empty library inventory from filtered updates", async () => {
  const copy = getResourceReleaseControlCopy("en");
  state.updates.mockResolvedValueOnce({
    items: [],
    counts: { all: 0, updates: 0, pinned: 0, unavailable: 0 },
    page: 1,
    totalPages: 1,
    pageSize: 20,
    total: 0,
  });
  const never = renderToStaticMarkup(
    await Updates({ searchParams: Promise.resolve({ filter: "all", page: "1" }) }),
  );
  expect(never).toContain(copy.emptyInventory);
  expect(never).toContain(copy.emptyInventoryHint);
  expect(never).toContain("overflow-x-clip");
  expect(never).not.toContain(copy.emptyFiltered);

  state.updates.mockResolvedValueOnce({
    items: [],
    counts: { all: 3, updates: 1, pinned: 1, unavailable: 1 },
    page: 1,
    totalPages: 1,
    pageSize: 20,
    total: 3,
  });
  const filtered = renderToStaticMarkup(
    await Updates({ searchParams: Promise.resolve({ filter: "updates", page: "1" }) }),
  );
  expect(filtered).toContain(copy.emptyFiltered);
  expect(filtered).toContain(copy.emptyFilteredHint);
  expect(filtered).toContain(copy.all);
  expect(filtered).not.toContain(copy.emptyInventory);
});
it("shows an honest recovery state when library updates fail", async () => {
  state.updates.mockRejectedValue(new Error("updates unavailable"));
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await Updates(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.updatesLoadUnavailable);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("filter=all");
  expect(html).toContain("page=2");
});
it("shows an honest recovery state when library versions fail", async () => {
  state.versions.mockRejectedValue(new Error("versions unavailable"));
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await Versions(input));
  expect(html).toContain('role="alert"');
  expect(html).toContain(copy.versionsLoadUnavailable);
  expect(html).toContain(copy.versionsLoadUnavailableDescription);
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("page=2");
  expect(html).not.toContain("versions unavailable");
});
it("shows EmptyState honesty when no approved versions are available", async () => {
  const detail = await state.versions();
  state.versions.mockResolvedValue({
    ...detail,
    latest: null,
    selected: null,
    versions: [],
  });
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await Versions(input));
  expect(html).toContain(copy.noVersions);
  expect(html).toContain(copy.noVersionsHint);
  expect(html).toContain("overflow-x-clip");
});
it("clips the library versions loading shell", async () => {
  const { default: VersionsLoading } = await import(
    "../site/src/app/workspace/library/[id]/versions/loading"
  );
  const copy = getResourceReleaseControlCopy("en");
  const html = renderToStaticMarkup(await VersionsLoading());
  expect(html).toContain("min-w-0");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain(copy.versions);
  expect(html).toContain(copy.updatesLoading);
});
it("requires sign-in before reading the buyer library", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await Updates(input))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Flibrary%2Fupdates%3Ffilter%3Dall%26page%3D2"',
  );
  expect(renderToStaticMarkup(await Versions(input))).toContain(
    'href="/auth/login?next=%2Fworkspace%2Flibrary%2Fprd_a%2Fversions%3Fpage%3D2"',
  );
  expect(state.updates).not.toHaveBeenCalled();
  expect(state.versions).not.toHaveBeenCalled();
  expect(metadata.robots).toMatchObject({ index: false, follow: false });
});
it.each(["en", "ru"] as const)(
  "a withdrawn fixed version offers management without silent replacement in %s",
  async (locale) => {
    state.locale = locale;
    for (const html of [
      renderToStaticMarkup(await Updates(input)),
      renderToStaticMarkup(await Versions(input)),
    ]) {
      expect(html).not.toContain("data-download");
      expect(html).not.toContain("PRIVATE-FILE");
      expect(html).toContain("&lt;Resource&gt;");
      expect(html).toContain(locale === "ru" ? "не заменяется" : "never silently replaced");
    }
  },
);
it("downloads only the explicitly selected cleared release", async () => {
  const result = await state.versions();
  state.versions.mockResolvedValue({
    ...result,
    selected: {
      id: "bld_fixed",
      version: "1.0.0",
      status: "published",
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 50,
      fileName: "fixed.zip",
      mimeType: "application/zip",
      scanStatus: "clean",
      scanner: "clamav",
      scannedAt: now,
      mtaVersionTarget: "1.6.0",
      isSigned: false,
      createdAt: now,
    },
  });
  const html = renderToStaticMarkup(await Versions(input));
  expect(html).toContain('data-download="bld_fixed"');
  expect(html).not.toContain('data-download="bld_latest"');
  expect(html).toContain("&lt;script&gt;unsafe text&lt;/script&gt;");
  expect(html).toContain('data-revision="3"');
  expect(html).toContain("a".repeat(64));
  expect(html).toContain("fileSizeBytes&quot;:100");
  expect(html).toContain('data-testid="build-provenance"');
  expect(html).toContain('data-build-id="bld_fixed"');
  expect(html).not.toContain("PRIVATE-FILE");
});
it("offers open, compare, and follow-latest actions when an update is available", async () => {
  const copy = getResourceReleaseControlCopy("en");
  state.updates.mockResolvedValueOnce({
    items: [
      {
        productId: "prd_a",
        title: "Racing HUD",
        slug: "racing-hud",
        state: "update_available",
        mode: "fixed",
        revision: 4,
        selectedVersion: "1.0.0",
        selectedBuildId: "bld_old",
        latestVersion: "2.0.0",
        latestBuildId: "bld_latest",
        watchEnabled: true,
        watchRevision: 2,
        watchUpdatedAt: now,
        hasAccess: true,
      },
    ],
    counts: { all: 1, updates: 1, pinned: 1, unavailable: 0 },
    page: 1,
    totalPages: 1,
    pageSize: 20,
    total: 1,
  });
  const html = renderToStaticMarkup(
    await Updates({ searchParams: Promise.resolve({ filter: "updates", page: "1" }) }),
  );
  expect(html).toContain('href="/market/racing-hud"');
  expect(html).toContain(copy.open);
  expect(html).toContain(
    'href="/workspace/library/prd_a/versions/compare?from=bld_old&amp;to=bld_latest"',
  );
  expect(html).toContain(copy.compare);
  expect(html).toContain('data-follow-latest="prd_a"');
  expect(html).toContain('data-revision="4"');
  expect(html).toContain('data-download="bld_old"');
  expect(html).toContain('data-watch="prd_a" data-enabled="true"');
});
it("masks unavailable resource metadata even if an upstream DTO includes it", async () => {
  const list = await state.updates();
  state.updates.mockResolvedValue({
    ...list,
    items: [
      {
        ...list.items[0],
        title: "PRIVATE-DRAFT-TITLE",
        state: "unavailable",
        latestVersion: null,
        latestBuildId: null,
      },
    ],
  });
  const detail = await state.versions();
  state.versions.mockResolvedValue({
    ...detail,
    product: { id: "prd_a", title: "PRIVATE-DRAFT-TITLE" },
    latest: null,
    selected: null,
    versions: [],
  });
  for (const html of [
    renderToStaticMarkup(await Updates(input)),
    renderToStaticMarkup(await Versions(input)),
  ]) {
    expect(html).not.toContain("PRIVATE-DRAFT-TITLE");
    expect(html).not.toContain("data-download");
  }
});
