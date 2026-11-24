import {
  AppError,
  type ExplicitFxRate,
  quoteExplicitFx,
  WALLET_CURRENCIES,
  type WalletCurrency,
} from "@nexus/domain";

/** Owner-only money on a profile. Guest preview and other visitors stay balance-free. */
export function showOwnProfileWallet(input: {
  actorId: string | undefined;
  profileUserId: string;
  guestPreview: boolean;
}): boolean {
  return (
    input.actorId !== undefined && input.actorId === input.profileUserId && !input.guestPreview
  );
}

export type ProfileFxLine =
  | { kind: "quote"; base: WalletCurrency; quote: WalletCurrency; amount: number }
  | { kind: "none" | "dust" | "invalid"; base: WalletCurrency; quote: WalletCurrency };

/** Estimates for the owner's known balances. A missing rate stays a missing rate. */
export function profileFxLines(
  balances: Array<{ currency: WalletCurrency; available: number | null }>,
  rates: readonly ExplicitFxRate[],
): ProfileFxLine[] {
  const lines: ProfileFxLine[] = [];
  for (const balance of balances) {
    if (balance.available === null) continue;
    for (const quote of WALLET_CURRENCIES) {
      if (quote === balance.currency) continue;
      const rate = rates.find(
        (item) => item.baseCurrency === balance.currency && item.quoteCurrency === quote,
      );
      if (!rate) {
        lines.push({ kind: "none", base: balance.currency, quote });
        continue;
      }
      try {
        lines.push({
          kind: "quote",
          base: balance.currency,
          quote,
          amount: quoteExplicitFx({
            sourceAmount: balance.available,
            baseAmount: rate.baseAmount,
            quoteAmount: rate.quoteAmount,
          }),
        });
      } catch (error) {
        lines.push({
          kind: error instanceof AppError && error.code === "FX_DUST" ? "dust" : "invalid",
          base: balance.currency,
          quote,
        });
      }
    }
  }
  return lines;
}

type BalanceReader = {
  getAvailableBalance(accountId: string, currency: WalletCurrency): Promise<number>;
};

/** One available figure per ledger currency. A failed read stays unknown, never zero. */
export async function loadOwnProfileBalances(
  service: BalanceReader,
  accountId: string,
): Promise<Array<{ currency: WalletCurrency; available: number | null }>> {
  return Promise.all(
    WALLET_CURRENCIES.map(async (currency) => {
      try {
        return { currency, available: await service.getAvailableBalance(accountId, currency) };
      } catch {
        return { currency, available: null };
      }
    }),
  );
}
