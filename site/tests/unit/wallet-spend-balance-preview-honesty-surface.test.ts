import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet spend balance preview honesty", () => {
  it("loads available balance before spend and links shortfall to site wallet", () => {
    const preview = read("site/src/features/commerce/components/wallet-spend-balance-preview.tsx");
    const checkout = read("site/src/features/commerce/components/wallet-checkout-button.tsx");
    const pay = read("site/src/features/commerce/components/wallet-pay-order-form.tsx");
    const i18n = read("site/src/features/commerce/wallet-i18n.ts");

    expect(preview).toContain("/api/wallet/balance");
    expect(preview).toContain("confirmedWalletBalance");
    expect(preview).toContain("spendTopUpLink");
    expect(preview).toContain("/workspace/wallet?currency=");
    expect(preview).toContain("data-wallet-spend-balance=");
    expect(checkout).toContain("WalletSpendBalancePreview");
    expect(checkout).toContain("walletSpendSubmitBlocked");
    expect(checkout).toContain("amountMinor");
    expect(pay).toContain("WalletSpendBalancePreview");
    expect(pay).toContain("amountMinor");
    expect(i18n).toContain("spendInsufficient");
    expect(i18n).toContain("spendBalanceUnavailable");
  });

  it("passes amountMinor and currency from acquire, detail, and purchase screens", () => {
    const acquire = read("site/src/features/commerce/components/acquire-page.tsx");
    const detail = read("site/src/features/resources/server/detail-page.tsx");
    const purchase = read("site/src/features/commerce/server/purchase-detail-screen.tsx");
    const operations = read("site/src/features/commerce/server/purchase-operations-screen.tsx");

    expect(acquire).toContain("amountMinor={product.price}");
    expect(acquire).toContain("buildId={buildId ?? undefined}");
    expect(detail).toContain("amountMinor={product.price}");
    expect(detail).toMatch(
      /buildId=\{\s*versionHelpBuild\?\.status === "published" \? versionHelpBuild\.id : undefined\s*\}/u,
    );
    expect(purchase).toContain("amountMinor={order.totalAmount}");
    expect(operations).toContain("amountMinor={result.order.totalAmount}");
  });
});
