import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orderTermsCopy, orderTermsNotice } from "../../src/features/commerce/order-terms-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("order-terms wallet honesty", () => {
  it("gates paid-checkout unavailable copy behind the wallet engine flag", () => {
    expect(orderTermsNotice("en", false)).toContain("Paid checkout remains unavailable");
    expect(orderTermsNotice("ru", false)).toContain("Платное оформление пока недоступно");
    expect(orderTermsNotice("en", true)).toBe(orderTermsCopy("en").walletNotice);
    expect(orderTermsNotice("ru", true)).toBe(orderTermsCopy("ru").walletNotice);
    expect(orderTermsNotice("en", true)).not.toContain("Paid checkout remains unavailable");
    expect(orderTermsNotice("ru", true)).not.toContain("Платное оформление пока недоступно");
    expect(orderTermsNotice("en", true)).toContain("audited site-wallet ledger spend");
    expect(orderTermsNotice("en", true)).toContain("still do not prove settle");
    expect(orderTermsNotice("en", true)).toContain("Card checkout and live payment-provider");

    const report = read("site/src/features/commerce/server/order-terms-report.tsx");
    const buyer = read("site/src/features/commerce/server/purchase-terms-screen.tsx");
    const admin = read(
      "site/src/features/commerce/server/financial-reconciliation-terms-screen.tsx",
    );
    expect(report).toContain("orderTermsNotice(locale, walletEnabled)");
    expect(buyer).toContain("walletEnabled={isWalletEngineEnabled()}");
    expect(admin).toContain("walletEnabled={isWalletEngineEnabled()}");
  });
});
