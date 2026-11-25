import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExplicitFxRate } from "@nexus/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { formatHistoryAmount } from "../../src/features/commerce/commerce-history-format";
import { getCommerceHistoryCopy } from "../../src/features/commerce/commerce-history-i18n";
import { PurchaseTotalEstimate } from "../../src/features/commerce/server/purchase-total-estimate";

const screen = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    "../../src/features/commerce/server/purchases-history-screen.tsx",
  ),
  "utf8",
);

const usdRate: ExplicitFxRate = {
  baseCurrency: "EUR",
  quoteCurrency: "USD",
  baseAmount: 100,
  quoteAmount: 110,
};

function markup(
  locale: "en" | "ru",
  amount: number,
  rates: readonly ExplicitFxRate[] | null | undefined,
) {
  return renderToStaticMarkup(
    <PurchaseTotalEstimate amount={amount} currency="EUR" locale={locale} rates={rates} />,
  );
}

describe("purchase history recorded-rate honesty", () => {
  it("loads rates only when the wallet engine is on and keeps a failed read on the page", () => {
    expect(screen).toMatch(
      /const fxRates[\s\S]*walletEnabled[\s\S]*listFxRates\(\)\.catch\(\(\) => null\)[\s\S]*: undefined/u,
    );
    expect(screen).toContain("<PurchaseTotalEstimate");
    expect(screen).not.toMatch(/listFxRates\(\)(?!\.catch)/u);
  });

  it("keeps a failed rate read distinct from a missing pair in English and Russian", () => {
    for (const locale of ["en", "ru"] as const) {
      const copy = getCommerceHistoryCopy(locale);
      const failed = markup(locale, 250, null);
      const missing = markup(locale, 250, [usdRate]);
      expect(failed).toContain(copy.purchaseEstimateUnavailable);
      expect(failed).not.toContain(copy.purchaseEstimateNone.slice(0, 12));
      expect(missing).toContain(
        copy.purchaseEstimateNone.replace("{base}", "EUR").replace("{quote}", "RUB"),
      );
      expect(missing).toContain(
        copy.purchaseEstimateQuote.replace("{amount}", formatHistoryAmount(275, "USD", locale)),
      );
      expect(missing).not.toContain(copy.purchaseEstimateUnavailable);
    }
  });

  it("uses its own sentence for dust and an invalid pair", () => {
    const copy = getCommerceHistoryCopy("en");
    const dust = markup(localeAmount(), 1, [
      { baseCurrency: "EUR", quoteCurrency: "USD", baseAmount: 10_000, quoteAmount: 1 },
      { baseCurrency: "EUR", quoteCurrency: "RUB", baseAmount: 10_000, quoteAmount: 1 },
    ]);
    expect(dust).toContain(
      copy.purchaseEstimateDust.replace("{base}", "EUR").replace("{quote}", "USD"),
    );
    expect(dust).not.toContain(copy.purchaseEstimateUnavailable);

    const invalid = markup("en", 50_000_000, [
      { baseCurrency: "EUR", quoteCurrency: "USD", baseAmount: 1, quoteAmount: 3 },
      { baseCurrency: "EUR", quoteCurrency: "RUB", baseAmount: 1, quoteAmount: 3 },
    ]);
    expect(invalid).toContain(
      copy.purchaseEstimateInvalid.replace("{base}", "EUR").replace("{quote}", "USD"),
    );
    expect(invalid).not.toContain(copy.purchaseEstimateUnavailable);
    expect(invalid).not.toContain(copy.purchaseEstimateDust.replace("{quote}", "USD"));
  });
});

function localeAmount(): "en" {
  return "en";
}
