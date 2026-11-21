import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { financialReviewNote, getFinancialCopy } from "../../src/features/commerce/financial-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("financial reconciliation wallet honesty", () => {
  it("gates read-only review note and ops pointers behind the wallet engine", () => {
    expect(financialReviewNote("en", false)).toBe(getFinancialCopy("en").reviewNote);
    expect(financialReviewNote("en", false)).toContain(
      "This view cannot settle, refund or repair an order.",
    );
    expect(financialReviewNote("en", true)).toBe(getFinancialCopy("en").walletReviewNote);
    expect(financialReviewNote("en", true)).toContain("audited ledger settle");
    expect(financialReviewNote("en", true)).toContain("This view stays read-only");
    expect(financialReviewNote("en", true)).not.toContain(
      "This view cannot settle, refund or repair an order.",
    );
    expect(financialReviewNote("ru", true)).toContain("ledger settle");

    const queue = read("site/src/features/commerce/server/financial-reconciliation-screen.tsx");
    const detail = read(
      "site/src/features/commerce/server/financial-reconciliation-detail-screen.tsx",
    );
    expect(queue).toContain("financialReviewNote(locale, walletEnabled)");
    expect(queue).toContain('href="/admin/commerce/order-cases"');
    expect(queue).toContain('href="/admin/commerce/wallet-providers"');
    expect(detail).toContain("financialReviewNote(locale, walletEnabled)");
    expect(detail).toContain('href="/admin/commerce/order-cases"');
    expect(detail).toContain('href="/admin/commerce/wallet-providers"');
    expect(detail).toContain("EmptyState");
    expect(detail).toContain("attemptsEmpty");
    expect(detail).toContain("attemptsEmptyHintWallet");
    expect(detail).not.toMatch(/<p className="text-secondary">\{copy\.empty\}<\/p>/);
  });

  it("keeps attempts empty copy distinct from load failure and wallet dialect honest", () => {
    const en = getFinancialCopy("en");
    const ru = getFinancialCopy("ru");
    expect(en.attemptsEmpty).toBe("No recorded payment attempts.");
    expect(en.attemptsEmptyHint).toContain("not a load failure");
    expect(en.attemptsEmptyHintWallet).toContain("Site-wallet");
    expect(en.attemptsEmptyHintWallet).toContain("read-only");
    expect(en.attemptsEmptyHintWallet).not.toContain("This view cannot settle, refund or repair");
    expect(ru.attemptsEmptyHintWallet).toContain("site wallet");
    expect(ru.attemptsEmptyHint).toContain("не ошибка загрузки");
  });
});
