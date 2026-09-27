import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getDictionary } from "../apps/web/src/lib/i18n";

const read = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("server follow surface", () => {
  it("exposes an authenticated follow state with private no-store caching", () => {
    const route = read("apps/web/src/app/api/follow/route.ts");

    expect(route).toContain(
      '{ authenticated: false, following: false }',
    );
    expect(route).toContain(
      '{ authenticated: true, following }',
    );
    expect(route).toContain(
      '"Cache-Control": "private, no-store"',
    );
    expect(route).toContain('Vary: "Cookie"');
    expect(route).toContain("isTargetType(targetType)");
    expect(route).toContain("targetId.length > 128");
  });

  it("uses the generic follow API with localized UI copy", () => {
    const component = read(
      "apps/web/src/components/server-follow-button.tsx",
    );
    const en = getDictionary("en").follow;
    const ru = getDictionary("ru").follow;

    expect(component).toContain(
      "/api/follow?targetType=server&targetId=",
    );
    expect(component).toContain('targetType: "server"');
    expect(component).toContain(
      'method: state === "following" ? "DELETE" : "POST"',
    );
    expect(component).toContain("confirmsFollowMutation(");
    expect(component).toContain("copy.following");
    expect(component).toContain("copy.follow");
    expect(en.follow).not.toBe(ru.follow);
    expect(en.following).not.toBe(ru.following);
    expect(component).not.toMatch(
      /alert|notify|notification/iu,
    );
  });

  it("places the follow control beside the real MTA connect action", () => {
    const page = read(
      "apps/web/src/app/servers/[slug]/page.tsx",
    );

    expect(page).toContain("<ServerFollowButton");
    expect(page).toContain("serverId={server.id}");
    expect(page).toContain("serverName={server.name}");
    expect(page).toContain("href={connectUri}");
    expect(page).toContain("{copy.connect}");
  });

  it("keeps saved servers backed by existing follows and locale copy", () => {
    const saved = read(
      "apps/web/src/app/workspace/saved/page.tsx",
    );

    expect(saved).toContain(
      'follow.targetType === "server"',
    );
    expect(saved).toContain("copy.servers");
    expect(saved).toContain("copy.noServers");
    expect(saved).toContain("copy.description");
    expect(saved).toContain("copy.discoverServers");
  });
});
