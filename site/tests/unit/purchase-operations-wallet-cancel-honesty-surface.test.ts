import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getCommercialCopy } from "../../src/features/commerce/commercial-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("purchase operations wallet cancel honesty", () => {
  it("gates cannot-cancel ErrorState copy on recorded site-wallet attempts", () => {
    const screen = read("site/src/features/commerce/server/purchase-operations-screen.tsx");
    const commercial = read("site/src/features/commerce/commercial-i18n.ts");

    expect(commercial).toContain("cannotCancelWallet");
    expect(commercial).toContain("cannotCancelWalletHint");
    expect(screen).toContain("hasWalletAttempt");
    expect(screen).toContain("cannotCancelWallet");
    expect(screen).toContain("cannotCancelWalletHint");
    expect(screen).toMatch(
      /hasWalletAttempt\s*\?\s*copy\.cannotCancelWalletHint\s*:\s*copy\.cannotCancelHint/,
    );
  });

  it("keeps wallet cancel copy off provider reconciliation dialect", () => {
    const en = getCommercialCopy("en");
    const ru = getCommercialCopy("ru");
    expect(en.cannotCancel).toContain("provider reconciliation");
    expect(en.cannotCancelWallet).toContain("site-wallet");
    expect(en.cannotCancelWallet).not.toContain("provider reconciliation");
    expect(en.cannotCancelWalletHint).toContain("audited ledger");
    expect(en.cannotCancelWalletHint).toContain("not provider reconciliation");
    expect(ru.cannotCancelWallet).toContain("site wallet");
    expect(ru.cannotCancelWalletHint).toContain("ledger");
    expect(ru.cannotCancelWalletHint).toContain("не через сверку с провайдером");
    expect(ru.cannotCancelWallet).not.toContain("требуют сверки с провайдером");
  });
});
