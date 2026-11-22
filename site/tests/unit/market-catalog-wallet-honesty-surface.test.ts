import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getDictionary } from "../../src/lib/i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("market catalog wallet honesty", () => {
  it("gates market catalog free-only chrome on the wallet engine", () => {
    const page = read("site/src/features/resources/server/market-page.tsx");
    const loading = read("site/src/features/resources/server/market-route-loading.tsx");

    expect(page).toContain("isWalletEngineEnabled");
    expect(page).toContain("walletTitle");
    expect(page).toContain("walletSearchPlaceholder");
    expect(page).toContain("walletEmptyHint");
    expect(page).toContain("walletLoadUnavailable");
    expect(loading).toContain("market.walletTitle");
    expect(loading).toContain("isWalletEngineEnabled");
  });

  it("keeps free-only catalog copy by default and admits paid market when wallet keys are used", () => {
    const en = getDictionary("en").market;
    const ru = getDictionary("ru").market;

    expect(en.title).toMatch(/free/i);
    expect(en.walletTitle).not.toMatch(/free/i);
    expect(en.searchPlaceholder).toMatch(/free/i);
    expect(en.walletSearchPlaceholder).not.toMatch(/free/i);
    expect(en.emptyHint).toMatch(/free/i);
    expect(en.walletEmptyHint).toMatch(/paid/i);
    expect(en.walletEmptyHint).toMatch(/site-wallet/i);
    expect(en.loadUnavailable).toMatch(/free/i);
    expect(en.walletLoadUnavailable).not.toMatch(/free/i);

    expect(ru.title).toMatch(/бесплатн/i);
    expect(ru.walletTitle).not.toMatch(/бесплатн/i);
    expect(ru.walletEmptyHint).toMatch(/платн/i);
    expect(ru.walletEmptyHint).toContain("site wallet");
  });
});
