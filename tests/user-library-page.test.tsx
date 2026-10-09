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
    default: ({ href, children, ...props }: {
      href: string;
      children: ReactNode;
      [key: string]: unknown;
    }) => React.createElement("a", { href, ...props }, children),
  };
});
vi.mock("../apps/web/src/components/resource-download-button", async () => {
  const React = await import("react");
  return {
    ResourceDownloadButton: ({ productId, version }: {
      productId: string;
      version: string;
    }) => React.createElement("button", {
      "data-testid": "safe-download", "data-product": productId,
      "data-version": version,
    }, "Download"),
  };
});

import LibraryPage, { metadata } from "../apps/web/src/app/workspace/library/page";

const now = new Date("2026-10-09T00:00:00.000Z");
const pageProps = (query: { page?: string | string[]; filter?: string | string[] } = {}) =>
  ({ searchParams: Promise.resolve(query) });

describe("private resource library", () => {
  beforeEach(() => {
    state.user = { id: "usr_player", role: "user" };
    state.locale = "en";
    state.page.mockReset().mockResolvedValue({
      items: [
        { resourceId: "prd_public", title: "<Resource A>", slug: "resource-a",
          version: "1.2.0", addedAt: now, downloadable: true },
        { resourceId: "prd_private", title: "SECRET DRAFT", slug: "secret-url",
          version: "2.0.0", addedAt: now, downloadable: false },
      ],
      counts: { all: 2, ready: 1, unavailable: 1 },
      total: 2, page: 1, pageSize: 12, totalPages: 1,
    });
  });

  it("requires login before any rights or library lookup", async () => {
    state.user = null;
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain("/auth/login");
    expect(html).toContain("Sign in to view your resource library");
    expect(state.page).not.toHaveBeenCalled();
  });

  it.each(["en", "ru"] as const)("renders localized safe rights and hides private product details in %s", async locale => {
    state.locale = locale;
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(state.page).toHaveBeenCalledWith("usr_player", 1, "all");
    expect(html).toContain("&lt;Resource A&gt;");
    expect(html).toContain("data-product=\"prd_public\"");
    expect(html).not.toContain("data-product=\"prd_private\"");
    expect(html).not.toContain("SECRET DRAFT");
    expect(html).not.toContain("secret-url");
    expect(html).not.toContain("href=\"/market/secret-url\"");
    expect(html).toContain(locale === "ru" ? "Библиотека ресурсов" : "Resource library");
    expect(html).toContain("/workspace/library?filter=ready");
  });

  it("preserves selected filter during pagination and clamps untrusted page input", async () => {
    state.page.mockResolvedValueOnce({
      items: [],
      counts: { all: 30, ready: 28, unavailable: 2 },
      total: 28, page: 2, pageSize: 12, totalPages: 3,
    });
    const html = renderToStaticMarkup(
      await LibraryPage(pageProps({ filter: "ready", page: "2" })),
    );
    expect(state.page).toHaveBeenCalledWith("usr_player", 2, "ready");
    expect(html).toContain("filter=ready&amp;page=3");
    expect(html).toContain('href="/workspace/library?filter=ready"');
    await LibraryPage(pageProps({ filter: ["ready"], page: ["2", "999"] }));
    expect(state.page).toHaveBeenLastCalledWith("usr_player", 1, "all");
  });

  it("distinguishes empty library from empty filtered view and keeps the route private", async () => {
    state.page.mockResolvedValueOnce({
      items: [], counts: { all: 0, ready: 0, unavailable: 0 },
      total: 0, page: 1, pageSize: 12, totalPages: 1,
    });
    const html = renderToStaticMarkup(await LibraryPage(pageProps()));
    expect(html).toContain("Your resource library is empty.");
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });
});
