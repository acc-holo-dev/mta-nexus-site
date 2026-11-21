import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet admin stale intent preview honesty", () => {
  it("keeps eligible top-up and withdrawal previews read-only and policy-gated", () => {
    const copy = getWalletCopy("en");
    expect(copy.providersAdminTopupPreviewNote).toContain("Read-only preview");
    expect(copy.providersAdminTopupPreviewNote).toContain("does not expire intents");
    expect(copy.providersAdminWithdrawPreviewNote).toContain("Read-only preview");
    expect(copy.providersAdminWithdrawPreviewNote).toContain("does not cancel intents");

    const service = read("site/src/lib/services/commerce/wallet-payment-service.ts");
    const screen = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");

    expect(service).toContain("listAdminEligibleStaleTopUps");
    expect(service).toContain("listAdminEligibleStaleWithdrawals");
    expect(screen).toContain("listAdminEligibleStaleTopUps");
    expect(screen).toContain("listAdminEligibleStaleWithdrawals");
    expect(screen).toContain("providersAdminTopupPreviewNote");
    expect(screen).toContain("providersAdminWithdrawPreviewNote");
  });
});
