import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getFinancialCopy } from "../../src/features/commerce/financial-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("finance workspace wallet empty/unavailable honesty", () => {
  it("keeps empty and failed wallet balances distinct from Not reconciled", () => {
    const copy = getFinancialCopy("en");
    expect(copy.emptyHintWallet).toContain("not a load failure");
    expect(copy.emptyHintWallet).toContain("not a payout promise");
    expect(copy.walletBalanceUnavailable).toContain("temporarily unavailable");
    expect(copy.walletBalanceUnavailable).not.toContain("Not reconciled");

    const screen = read("site/src/features/commerce/server/workspace-finance-screen.tsx");
    expect(screen).toContain("emptyHintWallet");
    expect(screen).toContain("walletBalanceUnavailable");
    expect(screen).toContain("walletEnabled ? copy.emptyHintWallet : copy.note");
    expect(screen).toContain("walletEnabled");
    expect(screen).toContain("copy.unknown");
  });

  it("states missing recorded rates once per finance section", () => {
    const screen = read("site/src/features/commerce/server/workspace-finance-screen.tsx");
    expect(screen).toContain("if (!copy || rates === null) return null");
    const notes = screen.match(/walletCopy\.recordedRateUnavailable/g) ?? [];
    expect(notes).toHaveLength(2);
    expect(screen).toContain('id="finance-totals-heading"');
  });
});
