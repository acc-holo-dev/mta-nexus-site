import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet settle receipt honesty", () => {
  it("names completed site-wallet settle on buyer receipt and operations", () => {
    const history = read("site/src/features/commerce/commerce-history-i18n.ts");
    const commercial = read("site/src/features/commerce/commercial-i18n.ts");
    const detail = read("site/src/features/commerce/server/purchase-detail-screen.tsx");
    const operations = read("site/src/features/commerce/server/purchase-operations-screen.tsx");

    expect(history).toContain("walletReceiptNote");
    expect(history).toContain("purchasedBuildEvidence");
    expect(history).toContain("does not pin download selection");
    expect(commercial).toContain("walletOperationsNote");
    expect(commercial).toContain("providerWallet");
    expect(detail).toContain("walletSettled ? copy.walletReceiptNote : copy.receiptNote");
    expect(detail).toContain("data-purchased-build-evidence");
    expect(detail).toContain("purchasedBuildEvidenceHint");
    expect(operations).toContain(
      "hasWalletAttempt ? copy.walletOperationsNote : copy.operationsNote",
    );
    expect(operations).toContain("commercialProviderLabel");
    expect(operations).toContain("attempt.provider");
  });

  it("surfaces recorded payment provider on financial reconciliation attempts", () => {
    const financial = read("site/src/features/commerce/financial-i18n.ts");
    const screen = read(
      "site/src/features/commerce/server/financial-reconciliation-detail-screen.tsx",
    );
    const statements = read("site/packages/db/src/repositories/financial-statements.ts");
    const ops = read("site/packages/db/src/repositories/order-operations.ts");

    expect(financial).toContain("financialProviderLabel");
    expect(financial).toContain("providerWallet");
    expect(screen).toContain("financialProviderLabel(locale, attempt.provider)");
    expect(statements).toContain("provider: payments.provider");
    expect(ops).toContain("provider: payments.provider");
  });
});
