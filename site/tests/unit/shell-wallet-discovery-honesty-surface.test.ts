import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("shell wallet discovery honesty", () => {
  it("gates home, hub, nav, and footer copy on the wallet engine flag", () => {
    const home = read("site/src/features/shell/server/home-page.tsx");
    const hub = read("site/src/features/shell/server/workspace-hub-page.tsx");
    const nav = read("site/src/features/shell/components/shell-navigation.ts");
    const footer = read("site/src/features/shell/components/footer.tsx");
    const layout = read("site/src/features/shell/server/root-layout.tsx");

    expect(home).toContain("isWalletEngineEnabled");
    expect(home).toContain("browseMarketResources");
    expect(home).toContain('"/market"');
    expect(home).toContain('"/market?maxPrice=0"');
    expect(hub).toContain("isWalletEngineEnabled");
    expect(hub).toContain("/workspace/wallet");
    expect(hub).toContain("browseMarketResources");
    expect(nav).toContain("walletEnabled");
    expect(nav).toContain("marketResources");
    expect(footer).toContain("walletSummary");
    expect(footer).toContain("marketResources");
    expect(layout).toContain("isWalletEngineEnabled");
    expect(layout).toContain("walletEnabled={walletEnabled}");
  });

  it("keeps localized wallet-aware discovery strings", () => {
    const en = getDictionary("en");
    const ru = getDictionary("ru");
    expect(en.home.browseMarketResources).toBe("Browse resources");
    expect(en.home.walletDescription).toContain("Site-wallet");
    expect(en.nav.marketResources).toBe("Resources");
    expect(en.footer.walletSummary).toContain("Site-wallet");
    expect(en.workspace.browseMarketResources).toBe("Browse resources");
    expect(ru.home.browseMarketResources).toBe("Смотреть ресурсы");
    expect(ru.home.walletDescription).toContain("site wallet");
    expect(ru.footer.walletSummary).toContain("site wallet");
  });
});
