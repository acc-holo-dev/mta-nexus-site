import { describe, expect, it } from "vitest";
import { confirmedWalletWithdrawalCancel } from "../../src/features/commerce/wallet-withdraw-cancel-confirmation";

describe("confirmedWalletWithdrawalCancel", () => {
  it("accepts a matching cancelled withdrawal response", () => {
    expect(
      confirmedWalletWithdrawalCancel(
        {
          organizationId: null,
          intent: {
            id: "wwd_test_cancel_1",
            status: "cancelled",
            amount: 1000,
            currency: "EUR",
            providerId: "stub",
            escrowAccountId: "escrow:wwithdraw_wwd_test_cancel_1",
          },
        },
        { intentId: "wwd_test_cancel_1" },
      ),
    ).toMatchObject({
      organizationId: null,
      intent: { id: "wwd_test_cancel_1", status: "cancelled", amount: 1000 },
    });
  });

  it("rejects non-cancelled status", () => {
    expect(
      confirmedWalletWithdrawalCancel(
        {
          organizationId: null,
          intent: {
            id: "wwd_test_cancel_2",
            status: "awaiting_provider",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "wwd_test_cancel_2" },
      ),
    ).toBeNull();
  });

  it("rejects organization mismatch", () => {
    expect(
      confirmedWalletWithdrawalCancel(
        {
          organizationId: "org_other",
          intent: {
            id: "wwd_test_cancel_3",
            status: "cancelled",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "wwd_test_cancel_3", organizationId: "org_sellers" },
      ),
    ).toBeNull();
  });
});
