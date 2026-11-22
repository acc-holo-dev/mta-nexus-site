import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resourceCartReceiptsCopy } from "../../src/features/resources/resource-cart-receipts-i18n";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("cart acquisition receipts wallet honesty", () => {
  it("gates receipts list and detail title/note on the wallet engine", () => {
    const list = read("site/src/features/resources/server/acquisition-receipts-screen.tsx");
    const detail = read("site/src/features/resources/server/acquisition-receipt-detail-screen.tsx");
    const i18n = read("site/src/features/resources/resource-cart-receipts-i18n.ts");

    expect(list).toContain("isWalletEngineEnabled");
    expect(list).toContain("walletTitle");
    expect(list).toContain("walletNote");
    expect(list).toContain("walletEnabled ? copy.walletTitle : copy.title");
    expect(list).toContain("walletEnabled ? copy.walletNote : copy.note");
    expect(detail).toContain("isWalletEngineEnabled");
    expect(detail).toContain("walletEnabled ? copy.walletTitle : copy.title");
    expect(detail).toContain("walletEnabled ? copy.walletNote : copy.note");
    expect(i18n).toContain("walletTitle");
    expect(i18n).toContain("walletNote");

    const acquisitions = read(
      "site/src/features/resources/server/publisher-acquisitions-screen.tsx",
    );
    const library = read("site/src/features/library/server/library-page-screen.tsx");
    expect(acquisitions).toContain("receiptsTitle");
    expect(library).toContain("receiptsTitle");
  });

  it("keeps free-cart receipt dialect by default and points paid settle elsewhere when wallet keys are used", () => {
    const en = resourceCartReceiptsCopy("en");
    const ru = resourceCartReceiptsCopy("ru");

    expect(en.title).toMatch(/free/i);
    expect(en.note).toMatch(/free library/i);
    expect(en.note).not.toMatch(/site-wallet/i);
    expect(en.walletTitle).toMatch(/cart/i);
    expect(en.walletTitle).not.toMatch(/free/i);
    expect(en.walletNote).toMatch(/site-wallet/i);
    expect(en.walletNote).toMatch(/purchase history/i);
    expect(en.walletNote).toMatch(/free cart/i);

    expect(ru.title).toMatch(/бесплатн/i);
    expect(ru.walletTitle).toMatch(/корзин/i);
    expect(ru.walletTitle).not.toMatch(/бесплатн/i);
    expect(ru.walletNote).toMatch(/site wallet/i);
    expect(ru.walletNote).toMatch(/истории покупок/i);
  });
});
