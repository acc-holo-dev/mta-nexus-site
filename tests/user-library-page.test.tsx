import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  user: { id: "usr_player", role: "user" } as { id: string; role: string } | null,
  locale: "en" as "en" | "ru",
  page: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => ({ value: "session-cookie" }) }),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/workspace/library",
}));
vi.mock("@nexus/db", () => ({
  userLibraryRepository: { pageByUser: state.page },
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: async () => state.locale,
}));
vi.mock("next/link", async () => {
  const React = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/components/resource-download-button", async () => {
  const React = await import("react");
  return {
    ResourceDownloadButton: ({
      productId,
      version,
      buildId,
    }: {
      productId: string;
      version: string;
      buildId?: string;
    }) =>
      React.createElement(
        "button",
        {
          "data-testid": "safe-download",
          "data-product": productId,
          "data-version": version,
          "data-build": buildId,
        },
        "Download",
      ),
  };
});

import LibraryLoading from "../apps/web/src/app/workspace/library/loading";
import LibraryPage, { metadata } from "../apps/web/src/app/workspace/library/page";
import { getLibraryCopy } from "../apps/web/src/lib/library-view";

const now = new Date("2026-10-09T00:00:00.000Z");
const pageProps = (query: { page?: string | string[]; filter?: string | string[] } = {}) => ({
  searchParams: Promise.resolve(query),
});

describe("private resource library", () => {
  beforeEach(() => {
    state.user = { id: "usr_player", role: "user" };
    state.locale = "en";
    state.page.mockReset().mockResolvedValue({
      items: [
        {
          resourceId: "prd_public",
          title: "<Resource A>",
          slug: "resource-a",
          version: "1.2.0",
          addedAt: now,
          downloadable: true,
        },
        {
          resourceId: "prd_private",
          title: "SECRET DRAFT",
          slug: "secret-url",
          version: "2.0.0",
          addedAt: now,
          downloadable: false,
        },
      ],
      counts: { all: 2, ready: 1, unavailable: 1 },
      total: 2,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    });
  });

  it.each(["en", "ru"] as const)(
    "renders an honest loading shell with localized library copy in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getLibraryCopy(locale);
      const html = renderToStaticMarkup(await LibraryLoading());
      expect(html).toContain('aria-busy="true"');
      expect(html).toContain('id="library-loading-heading"');
      expect(html).toContain('aria-labelledby="library-loading-heading"');
      expect(html).toContain(`>${copy.title}<`);
      expect(html).toContain(copy.loading);
    },
  );

  it("requires login before any rights or library lookup", async () => {
    state.user = null;
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain('href="/auth/login?next=%2Fworkspace%2Flibrary"');
    expect(html).toContain("Sign in required");
    expect(state.page).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)(
    "renders localized safe rights and hides private product details in %s",
    async (locale) => {
      state.locale = locale;
      const html = renderToStaticMarkup(await LibraryPage(pageProps()));
      expect(state.page).toHaveBeenCalledWith("usr_player", 1, "all");
      expect(html).toContain("&lt;Resource A&gt;");
      expect(html).toContain('data-product="prd_public"');
      expect(html).not.toContain('data-product="prd_private"');
      expect(html).not.toContain("SECRET DRAFT");
      expect(html).not.toContain("secret-url");
      expect(html).not.toContain('href="/market/secret-url"');
      expect(html).toContain(locale === "ru" ? "Библиотека ресурсов" : "Resource library");
      expect(html).toContain("/workspace/library?filter=ready");
      expect(html).toContain("/market/resource-a/versions");
      expect(html).not.toContain("/market/secret-url/versions");
    },
  );

  it("honors fixed download selections and keeps withdrawn selections manageable", async () => {
    state.page.mockResolvedValueOnce({
      items: [
        {
          resourceId: "prd_fixed",
          title: "Fixed release",
          slug: "fixed",
          version: "1.0.0",
          buildId: "bld_fixed",
          selectionMode: "fixed",
          addedAt: now,
          downloadable: true,
        },
        {
          resourceId: "prd_withdrawn",
          title: null,
          slug: null,
          version: null,
          buildId: null,
          selectionMode: "fixed",
          addedAt: now,
          downloadable: false,
        },
      ],
      counts: { all: 2, ready: 1, unavailable: 1 },
      total: 2,
      page: 1,
      totalPages: 1,
    });
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain('data-build="bld_fixed"');
    expect(html).not.toContain('data-product="prd_withdrawn"');
    expect(html).toContain("/workspace/library/prd_withdrawn/versions");
    expect(html).toContain("/workspace/library/updates");
  });

  it("preserves selected filter during pagination and clamps untrusted page input", async () => {
    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 30, ready: 28, unavailable: 2 },
      total: 28,
      page: 2,
      pageSize: 12,
      totalPages: 3,
    });
    const html = renderToStaticMarkup(await LibraryPage(pageProps({ filter: "ready", page: "2" })));
    expect(state.page).toHaveBeenCalledWith("usr_player", 2, "ready");
    expect(html).toContain("filter=ready&amp;page=3");
    expect(html).toContain('href="/workspace/library?filter=ready"');
    await LibraryPage(pageProps({ filter: ["ready"], page: ["2", "999"] }));
    expect(state.page).toHaveBeenLastCalledWith("usr_player", 1, "all");
  });

  it("distinguishes empty library from empty filtered view and keeps the route private", async () => {
    const copy = getLibraryCopy("en");
    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 0, ready: 0, unavailable: 0 },
      total: 0,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    });
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain(copy.empty);
    expect(html).toContain(copy.emptyHint);
    expect(html).not.toContain(copy.emptyFilterHint);
    expect(copy.emptyHint).not.toBe(copy.subtitle);
    expect(metadata.robots).toMatchObject({ index: false, follow: false });

    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 3, ready: 0, unavailable: 3 },
      total: 0,
      page: 1,
      pageSize: 12,
      totalPages: 1,
    });
    const filtered = renderToStaticMarkup(await LibraryPage(pageProps({ filter: "ready" })));
    expect(filtered).toContain(copy.emptyFilter);
    expect(filtered).toContain(copy.emptyFilterHint);
    expect(filtered).toContain(copy.clearFilters);
    expect(filtered).toContain('href="/workspace/library"');
    expect(filtered).not.toContain(copy.emptyHint);
    expect(copy.emptyFilterHint).not.toBe(copy.subtitle);
  });

  it.each(["en", "ru"] as const)(
    "opens a ready library resource on the public market detail in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getLibraryCopy(locale);
      const html = renderToStaticMarkup(await LibraryPage(pageProps()));
      expect(html).toContain('href="/market/resource-a"');
      expect(html).toContain(copy.open);
      expect(html).toContain("min-w-0 max-w-5xl");
      expect(html).toContain("overflow-x-clip");
      expect(html).not.toContain(copy.loadUnavailable);
    },
  );

  it("locks library filter nav chips to min-h-11 without h-10 chrome", async () => {
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain(
      "inline-flex min-h-11 items-center rounded-lg border border-base bg-surface px-4",
    );
    expect(html).not.toContain("inline-flex h-10 items-center");
  });

  it.each(["en", "ru"] as const)(
    "shows library load failures as alerts instead of an empty catalog in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getLibraryCopy(locale);
      state.page.mockRejectedValueOnce(new Error("private-database-detail"));
      const html = renderToStaticMarkup(await LibraryPage(pageProps({ filter: "ready" })));
      expect(html).toContain('role="alert"');
      expect(html).toContain(copy.loadUnavailable);
      expect(html).toContain('href="/workspace/library?filter=ready"');
      expect(html).not.toContain(copy.empty);
      expect(html).not.toContain(copy.emptyFilter);
      expect(html).not.toContain("private-database-detail");
      expect(html).not.toContain('href="/market/resource-a"');
    },
  );

  it("keeps guest return paths filter-aware before any library lookup", async () => {
    state.user = null;
    const html = renderToStaticMarkup(await LibraryPage(pageProps({ filter: "ready", page: "2" })));
    expect(html).toContain(
      'href="/auth/login?next=%2Fworkspace%2Flibrary%3Ffilter%3Dready%26page%3D2"',
    );
    expect(state.page).not.toHaveBeenCalled();
  });

  it("clips the honest loading shell on narrow layouts", async () => {
    const html = renderToStaticMarkup(await LibraryLoading());
    expect(html).toContain("min-w-0 max-w-5xl");
    expect(html).toContain("overflow-x-clip");
  });
});
