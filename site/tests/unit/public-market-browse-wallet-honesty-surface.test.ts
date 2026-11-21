import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("public market browse wallet honesty", () => {
  it("gates discover, developer, and organization empty market CTAs on the wallet engine", () => {
    const discover = read("site/src/features/discovery/server/discovery-directory.tsx");
    const developer = read("site/src/features/accounts/server/developer-profile-screen.tsx");
    const organization = read("site/src/features/organizations/server/public-profile.tsx");

    for (const source of [discover, developer, organization]) {
      expect(source).toContain("isWalletEngineEnabled");
      expect(source).toContain("libraryMarketHref");
      expect(source).toContain("browseMarketResources");
      expect(source).not.toMatch(/href=["']\/market\?maxPrice=0["']/);
    }
  });
});
