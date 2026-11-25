import { describe, expect, it } from "vitest";
import {
  loadOwnProfileBalances,
  profileWalletRates,
  showOwnProfileWallet,
} from "../../src/features/accounts/profile-wallet-visibility";

describe("own profile wallet visibility", () => {
  it("shows money only to the signed-in owner outside guest preview", () => {
    expect(
      showOwnProfileWallet({ actorId: "usr_a", profileUserId: "usr_a", guestPreview: false }),
    ).toBe(true);
    expect(
      showOwnProfileWallet({ actorId: "usr_a", profileUserId: "usr_b", guestPreview: false }),
    ).toBe(false);
    expect(
      showOwnProfileWallet({ actorId: undefined, profileUserId: "usr_a", guestPreview: false }),
    ).toBe(false);
    expect(
      showOwnProfileWallet({ actorId: "usr_a", profileUserId: "usr_a", guestPreview: true }),
    ).toBe(false);
  });

  it("keeps a failed currency read unknown instead of zero", async () => {
    const balances = await loadOwnProfileBalances(
      {
        getAvailableBalance: async (_accountId, currency) => {
          if (currency === "USD") throw new Error("ledger down");
          return currency === "EUR" ? 1250 : 0;
        },
      },
      "user:usr_a",
    );

    expect(balances).toEqual([
      { currency: "USD", available: null },
      { currency: "EUR", available: 1250 },
      { currency: "RUB", available: 0 },
    ]);
  });

  it("quotes recorded pairs and skips a missing pair, an unknown read, and zero", () => {
    expect(
      profileWalletRates(
        [
          { currency: "USD", available: 100 },
          { currency: "EUR", available: null },
          { currency: "RUB", available: 0 },
        ],
        [{ baseCurrency: "USD", quoteCurrency: "RUB", baseAmount: 100, quoteAmount: 9000 }],
      ),
    ).toEqual({
      kind: "lines",
      lines: [{ kind: "quote", base: "USD", quote: "RUB", amount: 9000 }],
    });
  });

  it("uses one note when no pair is recorded or the rate read failed", () => {
    expect(
      profileWalletRates(
        [
          { currency: "USD", available: 100 },
          { currency: "EUR", available: 50 },
        ],
        [],
      ),
    ).toEqual({ kind: "none", base: "USD", quote: "EUR" });
    expect(profileWalletRates([{ currency: "USD", available: 100 }], null)).toEqual({
      kind: "unavailable",
    });
    expect(profileWalletRates([{ currency: "USD", available: 0 }], null)).toBeNull();
    expect(profileWalletRates([{ currency: "USD", available: 100 }], undefined)).toBeNull();
  });

  it("keeps a recorded pair that is too small or invalid", () => {
    expect(
      profileWalletRates(
        [{ currency: "USD", available: 1 }],
        [
          { baseCurrency: "USD", quoteCurrency: "EUR", baseAmount: 100, quoteAmount: 1 },
          { baseCurrency: "USD", quoteCurrency: "RUB", baseAmount: 0, quoteAmount: 1 },
        ],
      ),
    ).toEqual({
      kind: "lines",
      lines: [
        { kind: "dust", base: "USD", quote: "EUR" },
        { kind: "invalid", base: "USD", quote: "RUB" },
      ],
    });
  });
});
