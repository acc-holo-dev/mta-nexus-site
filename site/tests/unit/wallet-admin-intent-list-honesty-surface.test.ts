import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet admin intent list honesty", () => {
  it("keeps the cross-account intent list read-only and engine-gated", () => {
    const copy = getWalletCopy("en");
    expect(copy.providersAdminIntentsNote).toContain("Read-only");
    expect(copy.providersAdminIntentsNote).toContain("does not credit, cancel, or settle");

    const service = read("site/src/lib/services/commerce/wallet-payment-service.ts");
    const screen = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");
    const topups = read("site/packages/db/src/repositories/wallet-topup.ts");
    const withdrawals = read("site/packages/db/src/repositories/wallet-withdrawal.ts");

    expect(service).toContain("listAdminRecentTopUps");
    expect(service).toContain("listAdminRecentWithdrawals");
    expect(service).toContain("listRecentAcrossAccounts");
    expect(screen).toContain("listAdminRecentTopUps");
    expect(screen).toContain("listAdminRecentWithdrawals");
    expect(screen).toContain("providersAdminIntentsNote");
    expect(screen).not.toMatch(/providersAdminIntentsTitle[\s\S]*WalletAdminBatchForm/u);
    expect(topups).toContain("listRecentAcrossAccounts");
    expect(withdrawals).toContain("listRecentAcrossAccounts");
  });
});
