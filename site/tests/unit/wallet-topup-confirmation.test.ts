import { describe, expect, it } from "vitest";
import { confirmedWalletTopUp } from "../../src/features/commerce/wallet-topup-confirmation";

describe("confirmedWalletTopUp", () => {
  it("accepts a matching stub top-up response", () => {
    expect(
      confirmedWalletTopUp(
        {
          intent: {
            id: "pay_test_wallet_1",
            status: "awaiting_provider",
            amount: 1000,
            currency: "EUR",
            providerId: "stub",
            createdAt: "2026-11-21T04:00:00.000Z",
          },
          redirectUrl: null,
        },
        { amount: 1000, currency: "EUR", providerId: "stub" },
      ),
    ).toMatchObject({
      intent: { id: "pay_test_wallet_1", status: "awaiting_provider" },
      redirectUrl: null,
    });
  });

  it("rejects amount or currency mismatch", () => {
    expect(
      confirmedWalletTopUp(
        {
          intent: {
            id: "pay_test_wallet_2",
            status: "awaiting_provider",
            amount: 500,
            currency: "EUR",
            providerId: "stub",
          },
          redirectUrl: null,
        },
        { amount: 1000, currency: "EUR", providerId: "stub" },
      ),
    ).toBeNull();
  });
});
