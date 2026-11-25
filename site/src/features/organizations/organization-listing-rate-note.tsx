import { type ExplicitFxRate, publicPriceEstimates } from "@nexus/domain";
import type { Locale } from "../../lib/i18n";
import { RecordedRateEstimate } from "../commerce/recorded-rate-estimate";

/**
 * Product cards already print a quote, or say the rate read failed.
 * A paid price with only missing, dust, or invalid pairs still has no line.
 */
export function OrganizationListingRateNote({
  price,
  currency,
  rates,
  locale,
}: {
  price: number;
  currency: string;
  rates: readonly ExplicitFxRate[] | null | undefined;
  locale: Locale;
}) {
  const estimates = publicPriceEstimates({ price, currency }, rates);
  if (estimates == null || estimates.some((line) => line.kind === "quote")) return null;
  if (locale !== "en" && locale !== "ru") return null;
  return (
    <RecordedRateEstimate
      amount={price}
      currency={currency}
      locale={locale}
      rates={rates ?? null}
    />
  );
}
