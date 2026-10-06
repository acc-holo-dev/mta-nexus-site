import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("discover surface", () => {
  it("uses a dedicated entity-scoped discover route", () => {
    const page = read("apps/web/src/app/discover/page.tsx");
    expect(page).toContain('form action="/discover"');
    expect(page).toContain("DISCOVER_TYPES.map");
    expect(page).toContain('type === "servers"');
    expect(page).toContain('type === "resources"');
    expect(page).toContain('type === "creators"');
    expect(page).toContain('type === "organizations"');
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
