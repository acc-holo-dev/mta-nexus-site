import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import { typeSmMuted } from "../../shell/type-shell";
import { formatFinancialMinor } from "../financial-i18n";
import { getWalletCopy } from "../wallet-i18n";

/** Shows a recorded-rate quote. The domain calculation is unchanged. */
export function RecordedRateEstimate({
  amount,
  currency,
  locale,
  rates,
  purpose = "amount",
}: {
  amount: number | string;
  currency: string;
  locale: "en" | "ru";
  rates: readonly ExplicitFxRate[] | null | undefined;
  purpose?: "amount" | "discount";
}) {
  const text = String(amount);
  if (!/^-?\d+$/u.test(text)) return null;
  const minor = Number(text);
  if (!Number.isSafeInteger(minor)) return null;
  const lines = publicPriceEstimates({ price: Math.abs(minor), currency }, rates);
  const copy = getWalletCopy(locale);
  if (lines === undefined) return null;
  if (lines === null) return <p className={typeSmMuted}>{copy.recordedRateUnavailable}</p>;
  const notable = lines.filter((line) => line.kind !== "none");
  if (notable.length === 0) return <p className={typeSmMuted}>{copy.recordedRateNone}</p>;
  return (
    <ul className={typeSmMuted}>
      {notable.map((line) => (
        <li key={line.quote}>
          {line.kind === "quote"
            ? (purpose === "discount" ? copy.recordedRateDiscount : copy.recordedRateEstimate)
                .replace("{base}", currency)
                .replace("{destination}", formatFinancialMinor(line.amount, line.quote, locale))
            : line.kind === "dust"
              ? copy.fxDust
              : copy.fxExceeds}
        </li>
      ))}
    </ul>
  );
}
