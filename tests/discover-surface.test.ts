import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const nav = vi.hoisted(() => ({
  pathname: "/",
  permanentRedirect: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  permanentRedirect: nav.permanentRedirect,
}));

vi.mock("next/link", async () => {
  const ReactModule = await import("react");
  return {
    default: ({ href, children, ...props }: { href: string; children?: React.ReactNode }) =>
      ReactModule.createElement("a", { href, ...props }, children),
  };
});

for (const modulePath of [
  "../apps/web/src/components/account-controls",
  "../apps/web/src/components/locale-switcher",
  "../apps/web/src/components/notification-bell",
  "../apps/web/src/components/theme-toggle",
]) {
  vi.mock(modulePath, async () => {
    const ReactModule = await import("react");
    return new Proxy(
      {},
      {
        get: (_target, property) =>
          () => ReactModule.createElement("span", { "data-mock": String(property) }),
      },
    );
  });
}

import { Sidebar } from "../apps/web/src/components/sidebar";
import { Navbar } from "../apps/web/src/components/navbar";
import ExplorePage from "../apps/web/src/app/explore/page";
import {
  DISCOVER_TYPES,
  discoverHref,
  parseDiscoverQuery,
} from "../apps/web/src/lib/discover-query";

describe("discover surface behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nav.pathname = "/";
  });

  it("keeps discovery entity-scoped and canonicalizes query state", () => {
    expect(DISCOVER_TYPES).toEqual([
      "servers",
      "resources",
      "creators",
      "organizations",
      "content",
    ]);
    expect(
      parseDiscoverQuery({
        type: ["resources", "servers"],
        q: ["  vehicle pack  ", "ignored"],
      }),
    ).toEqual({ type: "resources", query: "vehicle pack" });
    expect(
      discoverHref({ type: "organizations", query: "  nexus studio  " }),
    ).toBe("/discover?type=organizations&q=nexus+studio");
  });

  it("renders discover in both desktop ecosystem navigation and navbar search", () => {
    const sidebar = renderToStaticMarkup(
      React.createElement(Sidebar, {
        locale: "en",
        isCollapsed: false,
        onToggle: () => undefined,
      }),
    );
    const navbar = renderToStaticMarkup(
      React.createElement(Navbar, { locale: "en" }),
    );

    expect(sidebar).toContain('href="/discover"');
    expect(navbar).toContain('href="/discover"');
  });

  it("keeps /explore as a permanent compatibility redirect", () => {
    ExplorePage();
    expect(nav.permanentRedirect).toHaveBeenCalledWith("/discover");
  });
});
