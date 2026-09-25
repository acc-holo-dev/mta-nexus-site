import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server follow surface", () => {
  it("exposes an authenticated follow state with private no-store caching", () => {
    const route = read("apps/web/src/app/api/follow/route.ts");

    expect(route).toContain('{ authenticated: false, following: false }');
    expect(route).toContain('{ authenticated: true, following }');
    expect(route).toContain('"Cache-Control": "private, no-store"');
    expect(route).toContain("isTargetType(targetType)");
    expect(route).toContain("targetId.length > 128");
  });

  it("uses the existing generic follow API instead of a second watchlist model", () => {
    const component = read(
      "apps/web/src/components/server-follow-button.tsx",
    );

    expect(component).toContain(
      "/api/follow?targetType=server&targetId=",
    );
    expect(component).toContain('targetType: "server"');
    expect(component).toContain('method: state === "following" ? "DELETE" : "POST"');
    expect(component).toContain("Follow server");
    expect(component).toContain("Following");
    expect(component).not.toMatch(/alert|notify|notification/iu);
  });

  it("places the follow control beside the real MTA connect action", () => {
    const page = read("apps/web/src/app/servers/[slug]/page.tsx");

    expect(page).toContain(
      "<ServerFollowButton serverId={server.id} serverName={server.name} />",
    );
    expect(page).toContain('href={connectUri}');
    expect(page).toContain("Connect to Server");
  });

  it("keeps saved servers backed by existing follows", () => {
    const saved = read("apps/web/src/app/workspace/saved/page.tsx");

    expect(saved).toContain(
      'follows.filter((f) => f.targetType === "server")',
    );
    expect(saved).toContain("Saved Servers");
    expect(saved).toContain("Use the Follow button on any page");
  });
});
