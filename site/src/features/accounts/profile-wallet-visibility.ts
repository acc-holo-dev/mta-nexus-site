import {
  type ExplicitFxRate,
  publicPriceEstimates,
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
  | { kind: "dust" | "invalid"; base: WalletCurrency; quote: WalletCurrency };

export type ProfileWalletRates =
  | { kind: "unavailable" }
  | { kind: "none"; base: WalletCurrency; quote: WalletCurrency }
  | { kind: "lines"; lines: ProfileFxLine[] };

/**
 * Recorded-rate quotes for known positive balances.
 * Missing pairs are omitted. A failed read or a total absence of pairs is one note.
 * Zero stays on the balance line and is not quoted. Ledger math stays in the domain.
 */
export function profileWalletRates(
  balances: Array<{ currency: WalletCurrency; available: number | null }>,
  rates: readonly ExplicitFxRate[] | null | undefined,
): ProfileWalletRates | null {
  const positive = balances.filter(
    (balance): balance is { currency: WalletCurrency; available: number } =>
      balance.available !== null && balance.available > 0,
  );
  if (positive.length === 0 || rates === undefined) return null;
  if (rates === null) return { kind: "unavailable" };

  const lines: ProfileFxLine[] = [];
  let missing: { base: WalletCurrency; quote: WalletCurrency } | null = null;
  for (const balance of positive) {
    const estimates = publicPriceEstimates(
      { price: balance.available, currency: balance.currency },
      rates,
    );
    if (!estimates) continue;
    for (const line of estimates) {
      if (line.kind === "none") {
        missing ??= { base: line.base, quote: line.quote };
        continue;
      }
      lines.push(line);
    }
  }
  if (lines.length > 0) return { kind: "lines", lines };
  if (missing) return { kind: "none", base: missing.base, quote: missing.quote };
  return null;
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
