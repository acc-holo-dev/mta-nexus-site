import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import type { Locale } from "../../../lib/i18n";
import { typeXsMuted } from "../../shell/type-shell";
import { formatHistoryAmount } from "../commerce-history-format";
import { getCommerceHistoryCopy } from "../commerce-history-i18n";

/** Display-only recorded-rate lines. Does not read or write wallet or order rows. */
export function PurchaseTotalEstimate({
  amount,
  currency,
  locale,
  rates,
}: {
  amount: number;
  currency: string;
  locale: Locale;
  rates: readonly ExplicitFxRate[] | null | undefined;
}) {
  const copy = getCommerceHistoryCopy(locale === "ru" ? "ru" : "en");
  const lines = publicPriceEstimates({ price: amount, currency }, rates);
  if (lines === undefined) return null;
  if (lines === null) {
    return (
      <p className={typeXsMuted} role="note">
        {copy.purchaseEstimateUnavailable}
      </p>
    );
  }
  return (
    <ul className={typeXsMuted}>
      {lines.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? copy.purchaseEstimateQuote.replace(
                "{amount}",
                formatHistoryAmount(line.amount, line.quote, locale),
              )
            : line.kind === "dust"
              ? copy.purchaseEstimateDust
                  .replace("{base}", line.base)
                  .replace("{quote}", line.quote)
              : line.kind === "invalid"
                ? copy.purchaseEstimateInvalid
                    .replace("{base}", line.base)
                    .replace("{quote}", line.quote)
                : copy.purchaseEstimateNone
                    .replace("{base}", line.base)
                    .replace("{quote}", line.quote)}
        </li>
      ))}
    </ul>
  );
}
