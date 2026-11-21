import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkoutApiCopy } from "../../src/features/commerce/checkout-api-copy";

/** Wave 89: /api/checkout disabled envelope uses bilingual checkoutApiCopy. */
describe("checkout API copy honesty surface", () => {
  it("keeps RU/EN keys and wires the checkout route through nexus_locale", () => {
    const en = checkoutApiCopy("en");
    const ru = checkoutApiCopy("ru");
    expect(Object.keys(ru)).toEqual(Object.keys(en));
    expect(en.disabled).toContain("Card and live payment-provider checkout stays disabled");
    expect(en.disabled).toContain("site-wallet");
    expect(en.disabled).not.toMatch(/open free beta/i);
    expect(ru.disabled).toContain("Карточный и live checkout");
    expect(ru.disabled).toContain("site-wallet");
    expect(ru.disabled).not.toMatch(/бесплатной бете/i);

    const route = readFileSync(
      resolve(process.cwd(), "site/src/app/api/checkout/route.ts"),
      "utf8",
    );
    expect(route).toContain("checkoutApiCopy");
    expect(route).toContain("resolveLocale");
    expect(route).toContain("nexus_locale");
    expect(route).toContain("copy.disabled");
    expect(route).toContain("POST /api/checkout/wallet");
    expect(route).not.toContain('"Paid checkout is not available during the open free beta."');
  });
});
