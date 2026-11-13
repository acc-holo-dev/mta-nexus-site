import { describe, expect, it } from "vitest";
import { mapPublicResourceAttribution } from "../../site/src/lib/public-resource-attribution";
import { buttonClassName } from "../../site/packages/ui/src/button";

describe("mapPublicResourceAttribution", () => {
  it("maps public org and developer author paths without private fields", () => {
    const attribution = mapPublicResourceAttribution({
      authorUsername: "maya",
      authorDisplayName: "Maya Scripts",
      authorRole: "developer",
      organizationSlug: "nexus-lab",
      organizationName: "NEXUS Lab",
    });

    expect(attribution).toEqual({
      organization: { slug: "nexus-lab", name: "NEXUS Lab" },
      author: {
        username: "maya",
        displayName: "Maya Scripts",
        href: "/developers/maya",
      },
    });
    expect(JSON.stringify(attribution)).not.toMatch(/email|usr_|@/i);
  });

  it("falls back honestly when author or organization rows are missing", () => {
    expect(
      mapPublicResourceAttribution({
        authorUsername: null,
        authorDisplayName: null,
        authorRole: null,
        organizationSlug: null,
        organizationName: null,
      }),
    ).toEqual({ organization: null, author: null });
  });

  it("routes non-developer authors to the public user profile", () => {
    const attribution = mapPublicResourceAttribution({
      authorUsername: "player_one",
      authorDisplayName: "Player One",
      authorRole: "user",
      organizationSlug: null,
      organizationName: null,
    });

    expect(attribution.author?.href).toBe("/users/player_one");
  });
});

describe("buttonClassName geometry contract", () => {
  it("keeps Button and Link CTA chrome aligned for shared variants", () => {
    const primary = buttonClassName({ variant: "primary", size: "md" });
    const outlineSm = buttonClassName({ variant: "outline", size: "sm" });
    const hero = buttonClassName({ variant: "primary", size: "hero" });
    const touch = buttonClassName({ variant: "secondary", size: "touch" });

    expect(primary).toContain("h-10");
    expect(outlineSm).toContain("h-8");
    expect(hero).toContain("h-11");
    expect(touch).toContain("min-h-11");
    expect(primary).toContain("focus-visible:ring-2");
    expect(outlineSm).toContain("focus-visible:ring-2");
  });
});
