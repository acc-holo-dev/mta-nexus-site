import { AppError } from "./errors";
import { WALLET_CURRENCIES, type WalletCurrency } from "./wallet-payments";

/** Largest minor-unit amount the site wallet will quote. */
const FX_AMOUNT_LIMIT = 100_000_000;

export type ExplicitFxRate = {
  baseCurrency: WalletCurrency;
  quoteCurrency: WalletCurrency;
  baseAmount: number;
  quoteAmount: number;
};

function assertMinor(value: number, code: "FX_INVALID"): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > FX_AMOUNT_LIMIT) {
    throw new AppError("Exchange rate is invalid", 400, code);
  }
}

/**
 * Integer quote. `baseAmount` minor of the source currency corresponds to
 * `quoteAmount` minor of the destination currency. The result is floored.
 * Zero source stays zero. A positive source that floors to nothing is rejected.
 */
export function quoteExplicitFx(input: {
  sourceAmount: number;
  baseAmount: number;
  quoteAmount: number;
}): number {
  assertMinor(input.sourceAmount, "FX_INVALID");
  assertMinor(input.baseAmount, "FX_INVALID");
  assertMinor(input.quoteAmount, "FX_INVALID");
  if (input.baseAmount < 1 || input.quoteAmount < 1) {
    throw new AppError("Exchange rate is invalid", 400, "FX_INVALID");
  }
  if (input.sourceAmount === 0) return 0;
  const destination =
    (BigInt(input.sourceAmount) * BigInt(input.quoteAmount)) / BigInt(input.baseAmount);
  if (destination < 1n) {
    throw new AppError("Exchange rate leaves nothing to show", 400, "FX_DUST");
  }
  if (destination > BigInt(FX_AMOUNT_LIMIT)) {
    throw new AppError("Exchange estimate exceeds the supported amount", 400, "FX_EXCEEDS");
  }
  return Number(destination);
}

export type ExplicitFxLine =
  | { kind: "quote"; base: WalletCurrency; quote: WalletCurrency; amount: number }
  | { kind: "none" | "dust" | "invalid"; base: WalletCurrency; quote: WalletCurrency };

/** One source amount against the other wallet currencies. Missing rates stay missing. */
export function explicitFxLines(
  source: { currency: WalletCurrency; amount: number },
  rates: readonly ExplicitFxRate[],
): ExplicitFxLine[] {
  return WALLET_CURRENCIES.filter((quote) => quote !== source.currency).map((quote) => {
    const rate = rates.find(
      (item) => item.baseCurrency === source.currency && item.quoteCurrency === quote,
    );
    if (!rate) return { kind: "none" as const, base: source.currency, quote };
    try {
      return {
        kind: "quote" as const,
        base: source.currency,
        quote,
        amount: quoteExplicitFx({
          sourceAmount: source.amount,
          baseAmount: rate.baseAmount,
          quoteAmount: rate.quoteAmount,
        }),
      };
    } catch (error) {
      return {
        kind:
          error instanceof AppError && error.code === "FX_DUST"
            ? ("dust" as const)
            : ("invalid" as const),
        base: source.currency,
        quote,
      };
    }
  });
}

export function assertFxCurrencies(base: string, quote: string): void {
  if (
    !(WALLET_CURRENCIES as readonly string[]).includes(base) ||
    !(WALLET_CURRENCIES as readonly string[]).includes(quote)
  ) {
    throw new AppError("Exchange rate is invalid", 400, "FX_INVALID");
  }
  if (base === quote) {
    throw new AppError("Exchange rate must use two currencies", 400, "FX_SAME_CURRENCY");
  }
}
