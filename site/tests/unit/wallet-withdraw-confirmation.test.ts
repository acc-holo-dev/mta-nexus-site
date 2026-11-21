import { describe, expect, it } from "vitest";
import { confirmedWalletWithdrawal } from "../../src/features/commerce/wallet-withdraw-confirmation";

describe("confirmedWalletWithdrawal", () => {
  it("accepts a matching stub withdrawal response", () => {
    expect(
      confirmedWalletWithdrawal(
        {
          organizationId: null,
          intent: {
            id: "wwd_test_wallet_1",
            status: "awaiting_provider",
            amount: 1000,
            currency: "EUR",
            providerId: "stub",
            escrowAccountId: "escrow:wwithdraw_wwd_test_wallet_1",
          },
          actorId: "usr_wallet",
        },
        { amount: 1000, currency: "EUR", providerId: "stub" },
      ),
    ).toMatchObject({
      organizationId: null,
      intent: {
        id: "wwd_test_wallet_1",
        status: "awaiting_provider",
        escrowAccountId: "escrow:wwithdraw_wwd_test_wallet_1",
      },
    });
  });

  it("accepts a matching organization withdrawal response", () => {
    expect(
      confirmedWalletWithdrawal(
        {
          organizationId: "org_sellers",
          intent: {
            id: "wwd_test_org_1",
            status: "awaiting_provider",
            amount: 2500,
            currency: "EUR",
            providerId: "stub",
            escrowAccountId: "escrow:wwithdraw_wwd_test_org_1",
          },
        },
        {
          amount: 2500,
          currency: "EUR",
          providerId: "stub",
          organizationId: "org_sellers",
        },
      ),
    ).toMatchObject({
      organizationId: "org_sellers",
      intent: { id: "wwd_test_org_1" },
    });
  });

  it("rejects amount or currency mismatch", () => {
    expect(
      confirmedWalletWithdrawal(
        {
          organizationId: null,
          intent: {
            id: "wwd_test_wallet_2",
            status: "awaiting_provider",
            amount: 500,
            currency: "EUR",
            providerId: "stub",
            escrowAccountId: "escrow:wwithdraw_wwd_test_wallet_2",
          },
        },
        { amount: 1000, currency: "EUR", providerId: "stub" },
      ),
    ).toBeNull();
  });

  it("rejects organization mismatch", () => {
    expect(
      confirmedWalletWithdrawal(
        {
          organizationId: "org_other",
          intent: {
            id: "wwd_test_org_2",
            status: "awaiting_provider",
            amount: 1000,
            currency: "EUR",
            providerId: "stub",
            escrowAccountId: "escrow:wwithdraw_wwd_test_org_2",
          },
        },
        {
          amount: 1000,
          currency: "EUR",
          providerId: "stub",
          organizationId: "org_sellers",
        },
      ),
    ).toBeNull();
  });

  it("rejects missing escrow account id", () => {
    expect(
      confirmedWalletWithdrawal(
        {
          organizationId: null,
          intent: {
            id: "wwd_test_wallet_3",
            status: "awaiting_provider",
            amount: 1000,
            currency: "EUR",
            providerId: "stub",
          },
        },
        { amount: 1000, currency: "EUR", providerId: "stub" },
      ),
    ).toBeNull();
  });
});
