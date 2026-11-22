import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("home free showcase wallet honesty", () => {
  it("keeps the free-filtered showcase and gates wallet chrome on the engine", () => {
    const home = read("site/src/features/shell/server/home-page.tsx");

    expect(home).toContain("isWalletEngineEnabled");
    expect(home).toContain("resourcesTitleWallet");
    expect(home).toContain("resourcesDescriptionWallet");
    expect(home).toContain("browseFullMarket");
    expect(home).toContain("noResourcesWallet");
    expect(home).toContain('href="/market?maxPrice=0"');
    expect(home).toContain("listProducts({ maxPrice: 0");
  });

  it("keeps free showcase dialect by default and names the full market when wallet keys are used", () => {
    const en = getDictionary("en").home;
    const ru = getDictionary("ru").home;

    expect(en.resourcesTitle).toMatch(/free resources/i);
    expect(en.resourcesTitleWallet).toMatch(/free showcase/i);
    expect(en.resourcesDescriptionWallet).toMatch(/site wallet/i);
    expect(en.resourcesDescriptionWallet).toMatch(/full market/i);
    expect(en.browseFullMarket).toMatch(/full market/i);
    expect(en.noResourcesWallet).toMatch(/site-wallet/i);
    expect(en.viewAllResources).toMatch(/free/i);

    expect(ru.resourcesTitleWallet).toMatch(/витрин/i);
    expect(ru.resourcesDescriptionWallet).toMatch(/site wallet/i);
    expect(ru.browseFullMarket).toMatch(/маркет/i);
    expect(ru.noResourcesWallet).toMatch(/site wallet/i);
  });
});
