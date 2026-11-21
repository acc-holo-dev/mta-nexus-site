import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet admin unpaid-order preview honesty", () => {
  it("keeps the eligible unpaid-order preview read-only and engine-gated", () => {
    const copy = getWalletCopy("en");
    expect(copy.providersAdminUnpaidPreviewNote).toContain("Read-only preview");
    expect(copy.providersAdminUnpaidPreviewNote).toContain("does not cancel orders");

    const service = read("site/src/lib/services/commerce/wallet-payment-service.ts");
    const screen = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");
    const orders = read("site/packages/db/src/repositories/order-operations.ts");

    expect(service).toContain("listAdminEligibleStaleUnpaidOrders");
    expect(service).toContain("listEligibleStaleUnpaid");
    expect(screen).toContain("listAdminEligibleStaleUnpaidOrders");
    expect(screen).toContain("providersAdminUnpaidPreviewNote");
    expect(orders).toContain("listEligibleStaleUnpaid");
    const listStart = orders.indexOf("async listEligibleStaleUnpaid");
    const countStart = orders.indexOf("async countEligibleStaleUnpaid");
    expect(listStart).toBeGreaterThan(-1);
    expect(countStart).toBeGreaterThan(listStart);
    const preview = orders.slice(listStart, countStart);
    expect(preview).toContain("toISOString()");
    expect(preview).not.toContain('for("update")');
  });
});
