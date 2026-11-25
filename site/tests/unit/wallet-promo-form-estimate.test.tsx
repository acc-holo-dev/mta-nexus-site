import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseCommercialAmount } from "../../src/features/commerce/commercial-confirmation";
import { RecordedRateEstimate } from "../../src/features/commerce/components/recorded-rate-estimate";

vi.mock("../../src/features/shell/locale", () => ({
  useNexusLocale: () => ({ locale: "en" as const }),
}));

const rates = [
  {
    baseCurrency: "RUB" as const,
    quoteCurrency: "USD" as const,
    baseAmount: 100,
    quoteAmount: 1,
  },
];

describe("promo fixed-amount estimate", () => {
  it("quotes the typed minor amount before a code is saved", () => {
    const five = renderToStaticMarkup(
      <RecordedRateEstimate
        amount={parseCommercialAmount("5.00") ?? ""}
        currency="RUB"
        locale="en"
        rates={rates}
      />,
    );
    const twelve = renderToStaticMarkup(
      <RecordedRateEstimate
        amount={parseCommercialAmount("12.50") ?? ""}
        currency="RUB"
        locale="en"
        rates={rates}
      />,
    );
    expect(parseCommercialAmount("5.00")).toBe(500);
    expect(five).toContain("About 0.05 USD");
    expect(twelve).toContain("About 0.12 USD");
    expect(five).not.toContain("0.12 USD");
  });

  it("keeps the live quote on the create form and loads rates only with the engine", () => {
    const form = readFileSync(
      resolve(process.cwd(), "site/src/features/commerce/components/wallet-promo-form.tsx"),
      "utf8",
    );
    const screen = readFileSync(
      resolve(process.cwd(), "site/src/features/commerce/server/wallet-promo-screen.tsx"),
      "utf8",
    );
    expect(form).toContain("RecordedRateEstimate");
    expect(form).toContain("parseCommercialAmount(amount)");
    expect(form).toContain('onChange={(event) => setAmount(event.target.value)}');
    expect(form.indexOf('kind === "percent"')).toBeLessThan(form.indexOf("<RecordedRateEstimate"));
    expect(form).not.toContain("listFxRates");
    expect(screen).toContain("isWalletEngineEnabled()");
    const engineOn = screen.slice(screen.indexOf("isWalletEngineEnabled()"));
    expect(engineOn).toContain("listFxRates()");
    expect(engineOn.indexOf("listFxRates()")).toBeLessThan(engineOn.indexOf("promoEngineOff"));
  });
});
