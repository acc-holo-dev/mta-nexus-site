import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { orderCaseCopy } from "../../src/features/commerce/order-case-i18n";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("order-case refund-recommended inspect honesty", () => {
  it("keeps list inspect read-only and points refund execution to case detail", () => {
    const copy = orderCaseCopy("en");
    expect(copy.refundInspectNote).toContain("not an executed site-wallet refund");
    expect(copy.walletRefundExecutable).toContain("case detail");

    const page = read("site/src/features/commerce/server/order-case-page.tsx");
    const repo = read("site/packages/db/src/repositories/order-cases.ts");
    const operations = read("docs/OPERATIONS.md");
    const walletCopy = getWalletCopy("en");
    const providers = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");

    expect(page).toContain("refundInspectNote");
    expect(page).toContain("walletRefundExecutable");
    expect(page).toContain("WalletOrderRefundForm");
    expect(page).toContain('reviewStatus === "refund_recommended"');
    expect(repo).toContain("paymentProvider");
    expect(repo).toContain("recordedMatchingCaptureCount");
    expect(operations).toContain("reviewStatus=refund_recommended");
    expect(operations).toContain("recommendation is never an executed refund");
    expect(walletCopy.providersAdminRefundCasesLink).toContain("refund-recommended");
    expect(providers).toContain("/admin/commerce/order-cases?reviewStatus=refund_recommended");
  });
});
