import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppError } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  updates: vi.fn(),
  versions: vi.fn(),
  staff: vi.fn(),
  staffDetail: vi.fn(),
  publisher: vi.fn(),
  managed: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
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
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({ getRequestLocale: async () => state.locale }));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: { page: state.updates, detail: state.versions },
  resourceModerationService: {
    page: state.staff,
    detail: state.staffDetail,
    publisherHistory: state.publisher,
  },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { getManagedProduct: state.managed },
}));
vi.mock("../apps/web/src/components/resource-download-button", () => ({
  ResourceDownloadButton: ({ buildId }: { buildId?: string }) => (
    <button type="button" data-download={buildId}>
      Download
    </button>
  ),
}));
vi.mock("../apps/web/src/components/library-release-selection-controls", () => ({
  LibraryReleaseSelectionControls: ({ revision }: { revision: number }) => (
    <span data-revision={revision}>Preference</span>
  ),
}));
vi.mock("../apps/web/src/components/resource-moderation-controls", () => ({
  ResourceModerationControls: ({ product }: { product: { status: string } }) => (
    <span data-status={product.status}>Moderation</span>
  ),
}));
import Updates, { metadata } from "../apps/web/src/app/workspace/library/updates/page";
import Versions from "../apps/web/src/app/workspace/library/[id]/versions/page";
import Staff from "../apps/web/src/app/admin/resources/page";
import StaffDetail from "../apps/web/src/app/admin/resources/[id]/page";
import Publisher from "../apps/web/src/app/workspace/resources/[id]/moderation/page";
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
      },
    ],
    counts: { all: 41, updates: 1, pinned: 1, unavailable: 1 },
    ...bounds,
  });
  state.versions.mockReset().mockResolvedValue({
    product: { id: "prd_a", title: "<Resource>" },
    selection: { revision: 3, mode: "fixed", buildId: "withdrawn" },
    selected: null,
    latest: { id: "bld_latest", version: "2.0.0" },
    versions: [
      {
        id: "bld_latest",
        version: "2.0.0",
        releaseNotes: "<script>unsafe text</script>",
        createdAt: now,
        storageKey: "PRIVATE-FILE",
      },
    ],
    ...bounds,
  });
  state.staff.mockReset().mockResolvedValue({
    resources: [
      {
        id: "prd_a",
        title: "<Resource>",
        status: "suspended",
        currentVersion: "1.0.0",
        updatedAt: now,
      },
    ],
    ...bounds,
  });
  state.staffDetail.mockReset().mockResolvedValue({
    product: {
      id: "prd_a",
      title: "<Resource>",
      status: "suspended",
      currentVersion: "1.0.0",
      updatedAt: now,
    },
    events: [
      {
        id: "aud_a",
        action: "product.moderation_suspended",
        reason: "<Evidence>",
        createdAt: now,
      },
    ],
    ...bounds,
  });
  state.managed
    .mockReset()
    .mockResolvedValue({ id: "prd_a", title: "<Resource>", status: "suspended" });
  state.publisher.mockReset().mockResolvedValue({
    events: [
      {
        id: "aud_a",
        action: "product.moderation_suspended",
        reason: "<Evidence>",
        createdAt: now,
      },
    ],
    internalNotes: "PRIVATE-STAFF-NOTES",
    ...bounds,
  });
});
it("requires sign-in before reading the buyer library", async () => {
  state.user = null;
  expect(renderToStaticMarkup(await Updates(input))).toContain("/auth/login");
  expect(renderToStaticMarkup(await Versions(input))).toContain("/auth/login");
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
  state.versions.mockResolvedValue({ ...result, selected: { id: "bld_fixed", version: "1.0.0" } });
  const html = renderToStaticMarkup(await Versions(input));
  expect(html).toContain('data-download="bld_fixed"');
  expect(html).not.toContain('data-download="bld_latest"');
  expect(html).toContain("&lt;script&gt;unsafe text&lt;/script&gt;");
  expect(html).toContain('data-revision="3"');
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
it("rejects stale staff privilege before rendering the private queue", async () => {
  await expect(Staff(input)).rejects.toThrow("NEXT_NOT_FOUND");
  expect(state.staff).not.toHaveBeenCalled();
  state.user = { id: "usr_a", role: "moderator" };
  state.staff.mockRejectedValue(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(Staff(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
it("renders staff decisions with resource revision controls and bounded history", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  const html = renderToStaticMarkup(await StaffDetail(input));
  expect(html).toContain('data-status="suspended"');
  expect(html).toContain("&lt;Evidence&gt;");
  expect(html).toContain("page=3");
  expect(state.staffDetail).toHaveBeenCalledWith(state.user, "prd_a", 2);
});
it("shows the author a reason and review requirement without staff action controls", async () => {
  const html = renderToStaticMarkup(await Publisher(input));
  expect(html).toContain("&lt;Evidence&gt;");
  expect(html).toContain("submit a clean version for review");
  expect(html).not.toContain("PRIVATE-STAFF-NOTES");
  expect(html).not.toContain("data-status");
  state.managed.mockResolvedValue(null);
  await expect(Publisher(input)).rejects.toThrow("NEXT_NOT_FOUND");
});
