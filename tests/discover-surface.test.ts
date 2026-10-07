import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DISCOVER_TYPES,
  discoverHref,
  parseDiscoverQuery,
} from "../apps/web/src/lib/discover-query";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("discover surface", () => {
  it("keeps discovery entity-scoped and normalizes query state behaviorally", () => {
    expect(DISCOVER_TYPES).toEqual([
      "servers",
      "resources",
      "creators",
      "organizations",
      "content",
    ]);

    expect(parseDiscoverQuery({})).toEqual({
      type: "servers",
      query: "",
    });
    expect(
      parseDiscoverQuery({
        type: ["resources", "servers"],
        q: ["  vehicle pack  ", "ignored"],
      }),
    ).toEqual({
      type: "resources",
      query: "vehicle pack",
    });
    expect(
      parseDiscoverQuery({
        type: "all",
        q: "x".repeat(140),
      }),
    ).toEqual({
      type: "servers",
      query: "x".repeat(100),
    });

    expect(
      discoverHref({
        type: "organizations",
        query: "  nexus studio  ",
      }),
    ).toBe("/discover?type=organizations&q=nexus+studio");
    expect(discoverHref({ type: "content" })).toBe(
      "/discover?type=content",
    );
  });

  it("routes primary navigation and navbar search to discover", () => {
    const sidebar = read("apps/web/src/components/sidebar.tsx");
    const navbar = read("apps/web/src/components/navbar.tsx");
    expect(sidebar).toContain('href: "/discover"');
    expect(navbar).toContain('href="/discover"');
    expect(navbar).not.toContain("CommandPalette");
    expect(navbar).not.toContain("Ctrl K");
  });

  it("keeps the old explore URL as a compatibility redirect", () => {
    const legacy = read("apps/web/src/app/explore/page.tsx");
    expect(legacy).toContain('permanentRedirect("/discover")');
  });
});
