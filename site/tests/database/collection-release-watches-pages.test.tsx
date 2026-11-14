import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  user: { id: "usr_a" } as { id: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: "session" }) }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  usePathname: () => "/workspace/library/collections/lcol_a/watches",
}));
vi.mock("../../src/lib/i18n-server", () => ({ getRequestLocale: async () => h.locale }));
vi.mock("../../src/lib/services/auth-service", () => ({
  authService: { getSession: async () => h.user },
}));
vi.mock("../../src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: { collectionPage: h.page },
}));
vi.mock("../../src/features/resources/release-watch", () => ({
  ResourceReleaseWatchControl: ({ watch }: { watch: { productId: string; enabled: boolean } }) => (
    <button type="button" data-watch={watch.productId} data-enabled={String(watch.enabled)}>
      Watch
    </button>
  ),
}));

import Page, { metadata } from "../../src/app/workspace/library/collections/[id]/watches/page";
import { getDictionary } from "../../src/lib/i18n";

const screen = async () =>
  renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "lcol_a" }),
      searchParams: Promise.resolve({ filter: "disabled", page: "2", query: "Core" }),
    }),
  );
beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: "usr_a" };
  h.locale = "en";
  h.page.mockResolvedValue({
    collection: { id: "lcol_a", name: "<Core>", status: "active", revision: 3 },
    activeWatchCount: 4,
    items: [
      {
        productId: "prd_a",
        enabled: false,
        revision: 0,
        available: true,
        title: "Root",
        slug: "root-core",
        updatedAt: null,
      },
      {
        productId: "prd_b",
        enabled: false,
        revision: 2,
        available: false,
        title: "PRIVATE-TITLE",
        slug: null,
        updatedAt: null,
      },
    ],
    counts: { all: 22, enabled: 0, disabled: 22, unavailable: 1 },
    page: 2,
    totalPages: 3,
  });
});
it.each(["en", "ru"] as const)(
  "offers explicit future-release enrollment while masking unavailable titles in %s",
  async (locale) => {
    h.locale = locale;
    const html = await screen();
    expect(html).toContain("&lt;Core&gt;");
    expect(html).not.toContain("PRIVATE-TITLE");
    expect(html).toContain(
      locale === "ru" ? "Включить выбранные подписки" : "Enable selected watches",
    );
    expect(html).toContain("4/100");
    expect(html).toContain("query=Core");
    expect(html).toContain("/workspace/library/watches");
    expect(html).toContain("/workspace/library/collections/lcol_a/releases");
    expect(html).toContain('data-watch="prd_a"');
    expect(html).toContain('data-watch="prd_b"');
    expect(html).toContain('href="/market/root-core"');
    expect(html).not.toContain("/market/PRIVATE");
    expect(metadata.robots).toEqual({ index: false, follow: false });
  },
);
it("leaves archived collections inspectable without enrollment controls", async () => {
  const result = await h.page();
  h.page.mockResolvedValue({ ...result, collection: { ...result.collection, status: "archived" } });
  const html = await screen();
  expect(html).toContain("Restore it before enrolling");
  expect(html).not.toContain("Enable selected watches");
});
it("requires sign-in before reading a private collection", async () => {
  h.user = null;
  const html = await screen();
  expect(html).toContain(getDictionary("en").workspace.signInRequired);
  expect(html).toContain("/auth/login?next=");
  expect(html).toContain("%2Fworkspace%2Flibrary%2Fcollections%2Flcol_a%2Fwatches");
  expect(h.page).not.toHaveBeenCalled();
});
it("offers a filter reset when a collection watch page is empty", async () => {
  h.page.mockResolvedValue({
    collection: { id: "lcol_a", name: "Core", status: "active", revision: 3 },
    activeWatchCount: 0,
    items: [],
    counts: { all: 3, enabled: 0, disabled: 3, unavailable: 0 },
    page: 1,
    totalPages: 1,
  });
  const html = renderToStaticMarkup(
    await Page({
      params: Promise.resolve({ id: "lcol_a" }),
      searchParams: Promise.resolve({ filter: "disabled" }),
    }),
  );
  expect(html).toContain("No resource watches match this filter.");
  expect(html).toContain("Try another filter or clear search");
  expect(html).toContain("Clear filters");
  expect(html).toContain("filter=all");
  expect(html).toContain("overflow-x-clip");
});
it("shows an honest recovery state when collection watches fail", async () => {
  h.page.mockRejectedValue(new Error("watches unavailable"));
  const html = await screen();
  expect(html).toContain('role="alert"');
  expect(html).toContain("Release watches are temporarily unavailable");
  expect(html).toContain("overflow-x-clip");
  expect(html).toContain("filter=disabled");
  expect(html).toContain("query=Core");
});
