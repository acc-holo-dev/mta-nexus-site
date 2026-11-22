import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getLibraryCopy } from "../../src/features/library/library-view";
import { resourceReviewCopy } from "../../src/features/resources/resource-review-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("library grant wallet honesty", () => {
  it("gates library note and review subtitle on the wallet engine", () => {
    const libraryPage = read("site/src/features/library/server/library-page-screen.tsx");
    const libraryView = read("site/src/features/library/library-view.ts");
    const reviews = read("site/src/features/resources/server/reviews-page.tsx");
    const ownReviews = read("site/src/features/library/server/library-reviews-screen.tsx");
    const reviewI18n = read("site/src/features/resources/resource-review-i18n.ts");

    expect(libraryPage).toContain("noteWallet");
    expect(libraryPage).toContain("walletEnabled ? copy.noteWallet : copy.note");
    expect(libraryPage).toContain("subtitleWallet");
    expect(libraryPage).toContain("walletEnabled ? copy.subtitleWallet : copy.subtitle");
    expect(libraryView).toContain("noteWallet");
    expect(libraryView).toContain("subtitleWallet");
    expect(reviews).toContain("walletSubtitle");
    expect(reviews).toContain("isWalletEngineEnabled");
    expect(ownReviews).toContain("walletSubtitle");
    expect(reviewI18n).toContain("walletSubtitle");
  });

  it("keeps free-grant dialect by default and admits paid site-wallet grants when wallet keys are used", () => {
    const libraryEn = getLibraryCopy("en");
    const libraryRu = getLibraryCopy("ru");
    const reviewEn = resourceReviewCopy("en");
    const reviewRu = resourceReviewCopy("ru");

    expect(libraryEn.subtitle).not.toMatch(/site-wallet/i);
    expect(libraryEn.subtitleWallet).toMatch(/site-wallet/i);
    expect(libraryEn.subtitleWallet).toMatch(/free claims/i);
    expect(libraryRu.subtitleWallet).toMatch(/site wallet/i);
    expect(libraryRu.subtitleWallet).toMatch(/бесплатные claim/i);

    expect(libraryEn.note).not.toMatch(/site-wallet/i);
    expect(libraryEn.noteWallet).toMatch(/site-wallet/i);
    expect(libraryEn.noteWallet).toMatch(/payment ledger/i);
    expect(libraryRu.noteWallet).toMatch(/site wallet/i);
    expect(libraryRu.noteWallet).toMatch(/ledger/i);

    expect(reviewEn.subtitle).toMatch(/free resources/i);
    expect(reviewEn.subtitle).not.toMatch(/site-wallet/i);
    expect(reviewEn.walletSubtitle).toMatch(/site-wallet/i);
    expect(reviewEn.walletSubtitle).not.toMatch(/free resources and legacy/i);
    expect(reviewRu.walletSubtitle).toMatch(/site wallet/i);
    expect(reviewRu.walletSubtitle).not.toMatch(/бесплатные ресурсы и старые/i);
  });
});
