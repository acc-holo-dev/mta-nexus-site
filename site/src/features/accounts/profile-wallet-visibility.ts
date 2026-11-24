import { WALLET_CURRENCIES, type WalletCurrency } from "@nexus/domain";

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
