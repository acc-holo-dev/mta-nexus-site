import { describe, expect, it } from "vitest";
import {
  loadOwnProfileBalances,
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
});
