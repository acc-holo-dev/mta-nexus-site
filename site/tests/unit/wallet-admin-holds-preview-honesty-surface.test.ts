import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getWalletCopy } from "../../src/features/commerce/wallet-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("wallet admin matured-holds preview honesty", () => {
  it("keeps the eligible matured-holds preview read-only and engine-gated", () => {
    const copy = getWalletCopy("en");
    expect(copy.providersAdminHoldsPreviewNote).toContain("Read-only preview");
    expect(copy.providersAdminHoldsPreviewNote).toContain("does not release holds");

    const service = read("site/src/lib/services/commerce/wallet-payment-service.ts");
    const screen = read("site/src/features/commerce/server/wallet-providers-admin-screen.tsx");
    const holds = read("site/packages/db/src/repositories/wallet-seller-holds.ts");

    expect(service).toContain("listAdminEligibleMaturedHolds");
    expect(service).toContain("listEligibleMatured");
    expect(screen).toContain("listAdminEligibleMaturedHolds");
    expect(screen).toContain("providersAdminHoldsPreviewNote");
    expect(holds).toContain("listEligibleMatured");
    const preview = holds.match(
      /async listEligibleMatured[\s\S]*?return rows\.map\(mapHold\);\s*\}/u,
    )?.[0];
    expect(preview).toBeTruthy();
    expect(preview).not.toContain('for("update")');
  });
});
