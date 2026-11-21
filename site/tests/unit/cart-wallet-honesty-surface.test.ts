import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getResourceCommerceCopy,
  resourceCartHonestyCopy,
} from "../../src/features/resources/resource-commerce-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("cart wallet honesty", () => {
  it("gates free-cart copy on the wallet engine without enabling paid cart settle", () => {
    const screen = read("site/src/features/commerce/server/cart-workspace-screen.tsx");
    const controls = read("site/src/features/resources/components/resource-cart-controls.tsx");
    const i18n = read("site/src/features/resources/resource-commerce-i18n.ts");

    expect(screen).toContain("isWalletEngineEnabled");
    expect(screen).toContain("resourceCartHonestyCopy");
    expect(screen).toContain("walletEnabled={walletEnabled}");
    expect(controls).toContain("resourceCartHonestyCopy");
    expect(controls).toContain("walletEnabled");
    expect(i18n).toContain("walletSubtitle");
    expect(i18n).toContain("walletNote");
    expect(i18n).toContain("walletBatchIntent");

    const en = getResourceCommerceCopy("en");
    const honestyOff = resourceCartHonestyCopy("en", false);
    const honestyOn = resourceCartHonestyCopy("en", true);
    expect(honestyOff.subtitle).toBe(en.subtitle);
    expect(honestyOff.batchIntent).toBe(en.batchIntent);
    expect(honestyOn.subtitle).toContain("free library claims only");
    expect(honestyOn.subtitle).toContain("site wallet");
    expect(honestyOn.note).toContain("Card checkout stays off");
    expect(honestyOn.batchIntent).toContain("Free batch claim only");
    expect(honestyOn.batchIntent).not.toContain("settle with site wallet from this cart");

    const ru = resourceCartHonestyCopy("ru", true);
    expect(ru.subtitle).toContain("site wallet");
    expect(ru.note).toContain("Карточный checkout");
  });
});
