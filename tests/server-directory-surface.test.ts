import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDictionary } from "../apps/web/src/lib/i18n";

const state = vi.hoisted(() => ({
  locale: "en" as "en" | "ru",
  listings: vi.fn(),
  lastProfiles: null as Record<string, string> | null,
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({
      href,
      children,
      ...props
    }: {
      href: string;
      children: React.ReactNode;
      [key: string]: unknown;
    }) => ReactModule.createElement("a", { href, ...props }, children),
  };
});

vi.mock("../apps/web/src/lib/i18n-server", () => ({
  getRequestLocale: vi.fn(async () => state.locale),
}));

vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { listServers: state.listings },
}));

vi.mock("../apps/web/src/components/mta-master-server-directory", async () => {
  const ReactModule = await import("react");
  return {
    MtaMasterServerDirectory: ({
      locale,
      profileByEndpoint,
    }: {
      locale: string;
      profileByEndpoint?: Record<string, string>;
    }) => {
      state.lastProfiles = profileByEndpoint ?? {};
      return ReactModule.createElement("section", {
        "data-testid": "mta-directory",
        "data-locale": locale,
        "data-profiles": String(Object.keys(profileByEndpoint ?? {}).length),
      });
    },
  };
});

import ServersLoading from "../apps/web/src/app/servers/loading";
import ServersPage from "../apps/web/src/app/servers/page";

describe("public MTA directory page behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.locale = "en";
    state.lastProfiles = null;
    state.listings.mockResolvedValue([
      { ipAddress: "203.0.113.10", port: 22003, slug: "mapped-nexus" },
    ]);
  });

  it.each(["en", "ru"] as const)(
    "renders localized directory shell and one paginated client directory in %s",
    async (locale) => {
      state.locale = locale;
      const copy = getDictionary(locale).servers;
      const html = renderToStaticMarkup(await ServersPage());

      expect(html).toContain(copy.title);
      expect(html).toContain(copy.description);
      expect(html).toContain(copy.addListing);
      expect(html).toContain('href="/workspace/servers/new"');
      expect(html).toContain("min-w-0 space-y-8 overflow-x-clip");
      expect(html).toContain('data-testid="mta-directory"');
      expect(html).toContain(`data-locale="${locale}"`);
      expect(html).toContain('data-profiles="1"');
      expect(state.lastProfiles).toEqual({ "203.0.113.10:22003": "mapped-nexus" });
      expect((html.match(/data-testid="mta-directory"/gu) ?? []).length).toBe(1);
      expect(state.listings).toHaveBeenCalledWith(200);
    },
  );

  it("keeps the catalog shell when listing lookup fails", async () => {
    state.listings.mockRejectedValueOnce(new Error("PRIVATE_SQL"));
    const html = renderToStaticMarkup(await ServersPage());
    expect(html).toContain('data-testid="mta-directory"');
    expect(html).toContain('data-profiles="0"');
    expect(html).not.toContain("PRIVATE_SQL");
  });

  it("clips the honest loading shell on narrow layouts", async () => {
    const html = renderToStaticMarkup(await ServersLoading());
    expect(html).toContain("min-w-0 space-y-8 overflow-x-clip");
    expect(html).toContain('aria-busy="true"');
  });
});
