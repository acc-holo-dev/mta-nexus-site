import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet admin batch eligible preview honesty", () => {
  it("surfaces read-only eligible counts without implying a cron or live PSP", () => {
    const copy = getWalletCopy("en");
    expect(copy.providersAdminOpsNote).toContain("Eligible counts are a read-only preview");
    expect(copy.providersAdminOpsNote).toContain("not a cron");
    expect(copy.providersAdminOpsNote).toContain("not a live PSP");
    expect(copy.providersAdminEligible).toContain("{count}");

    const service = read("site/src/lib/services/commerce/wallet-payment-service.ts");
    const screen = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");
    const form = read("site/src/features/commerce/components/wallet-admin-batch-form.tsx");
    const holds = read("site/packages/db/src/repositories/wallet-seller-holds.ts");
    const topups = read("site/packages/db/src/repositories/wallet-topup.ts");
    const withdrawals = read("site/packages/db/src/repositories/wallet-withdrawal.ts");
    const orders = read("site/packages/db/src/repositories/order-operations.ts");

    expect(service).toContain("previewAdminBatchEligible");
    expect(service).toContain("countEligibleMatured");
    expect(service).toContain("countEligibleStaleAwaiting");
    expect(service).toContain("countEligibleStaleUnpaid");
    expect(screen).toContain("previewAdminBatchEligible");
    expect(screen).toContain("eligibleLabel");
    expect(form).toContain("eligibleLabel");
    expect(holds).toContain("countEligibleMatured");
    expect(holds).toContain("listEligibleMatured");
    const holdsList = holds.match(
      /async listEligibleMatured[\s\S]*?return rows\.map\(mapHold\);\s*\}/u,
    )?.[0];
    expect(holdsList).toBeTruthy();
    expect(holdsList).not.toContain('for("update")');
    const holdsCount = holds.match(
      /async countEligibleMatured[\s\S]*?return \(await this\.listEligibleMatured\(input\)\)\.length;\s*\}/u,
    )?.[0];
    expect(holdsCount).toBeTruthy();
    expect(holdsCount).not.toContain('for("update")');
    expect(topups).toContain("countEligibleStaleAwaiting");
    expect(topups).toContain("listEligibleStaleAwaiting");
    expect(withdrawals).toContain("countEligibleStaleAwaiting");
    expect(withdrawals).toContain("listEligibleStaleAwaiting");
    expect(orders).toContain("countEligibleStaleUnpaid");
    expect(orders).toContain("listEligibleStaleUnpaid");
    const unpaidListStart = orders.indexOf("async listEligibleStaleUnpaid");
    const unpaidCountStart = orders.indexOf("async countEligibleStaleUnpaid");
    expect(unpaidListStart).toBeGreaterThan(-1);
    expect(unpaidCountStart).toBeGreaterThan(unpaidListStart);
    const unpaidList = orders.slice(unpaidListStart, unpaidCountStart);
    expect(unpaidList).toContain("toISOString()");
    expect(unpaidList).not.toContain('for("update")');
    const unpaidCountEnd = orders.indexOf("async expireStaleUnpaid", unpaidCountStart);
    const unpaidCount = orders.slice(unpaidCountStart, unpaidCountEnd);
    expect(unpaidCount).toContain("return (await this.listEligibleStaleUnpaid(input)).length;");
    expect(unpaidCount).not.toContain('for("update")');
    for (const source of [topups, withdrawals]) {
      const listStart = source.indexOf("async listEligibleStaleAwaiting");
      const countStart = source.indexOf("async countEligibleStaleAwaiting");
      expect(listStart).toBeGreaterThan(-1);
      expect(countStart).toBeGreaterThan(listStart);
      const listBody = source.slice(listStart, countStart);
      expect(listBody).toContain("toIntent");
      expect(listBody).not.toContain('for("update")');
      const countBody = source.slice(
        countStart,
        source.indexOf("async expireStaleAwaiting", countStart),
      );
      expect(countBody).toContain("return (await this.listEligibleStaleAwaiting(input)).length;");
      expect(countBody).not.toContain('for("update")');
    }
  });
});
