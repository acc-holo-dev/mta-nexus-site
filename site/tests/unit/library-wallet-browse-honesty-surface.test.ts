import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { libraryCollectionsCopy } from "../../src/features/library/library-collections-i18n";
import { getLibraryCopy, libraryMarketHref } from "../../src/features/library/library-view";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("library wallet browse honesty", () => {
  it("gates library, collections, and reviews empty market CTAs on the wallet engine", () => {
    const library = read("site/src/features/library/server/library-page-screen.tsx");
    const collections = read("site/src/features/library/server/library-collections-list-view.tsx");
    const reviews = read("site/src/features/library/server/library-reviews-screen.tsx");
    const view = read("site/src/features/library/library-view.ts");

    expect(view).toContain("libraryMarketHref");
    expect(view).toContain("emptyHintWallet");
    expect(view).toContain("browseMarket");
    expect(library).toContain("isWalletEngineEnabled");
    expect(library).toContain("libraryMarketHref");
    expect(library).toContain("emptyHintWallet");
    expect(library).toContain("browseMarket");
    expect(library).not.toMatch(/href=["']\/market\?maxPrice=0["']/);
    expect(collections).toContain("isWalletEngineEnabled");
    expect(collections).toContain("libraryMarketHref");
    expect(collections).toContain("browseLibraryMarket");
    expect(collections).not.toMatch(/href=["']\/market\?maxPrice=0["']/);
    expect(reviews).toContain("isWalletEngineEnabled");
    expect(reviews).toContain("libraryMarketHref");
    expect(reviews).toContain("browseMarketResources");
    expect(reviews).not.toMatch(/href=["']\/market\?maxPrice=0["']/);
  });

  it("keeps free-only browse when the engine is off and opens full market when on", () => {
    expect(libraryMarketHref(false)).toBe("/market?maxPrice=0");
    expect(libraryMarketHref(true)).toBe("/market");

    const en = getLibraryCopy("en");
    const ru = getLibraryCopy("ru");
    expect(en.browse).toBe("Browse free resources");
    expect(en.browseMarket).toBe("Browse resources");
    expect(en.emptyHint).toContain("Free resources");
    expect(en.emptyHintWallet).toContain("Site-wallet");
    expect(en.emptyHintWallet).not.toContain(
      "Free resources and active grants show up here after they are added",
    );
    expect(ru.browseMarket).toBe("Каталог ресурсов");
    expect(ru.emptyHintWallet).toContain("site wallet");

    const collectionsEn = libraryCollectionsCopy("en");
    const collectionsRu = libraryCollectionsCopy("ru");
    expect(collectionsEn.browseLibrary).toBe("Browse free resources");
    expect(collectionsEn.browseLibraryMarket).toBe("Browse resources");
    expect(collectionsRu.browseLibraryMarket).toBe("Смотреть ресурсы");
  });
});
