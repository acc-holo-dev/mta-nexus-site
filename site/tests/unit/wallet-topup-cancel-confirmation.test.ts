import { describe, expect, it } from "vitest";
import { confirmedWalletTopUpCancel } from "../../src/features/commerce/wallet-topup-cancel-confirmation";

describe("confirmedWalletTopUpCancel", () => {
  it("accepts a cancelled personal top-up response", () => {
    expect(
      confirmedWalletTopUpCancel(
        {
          organizationId: null,
          intent: {
            id: "wtop_1",
            status: "cancelled",
            amount: 100,
            currency: "EUR",
          },
        },
        { intentId: "wtop_1" },
      ),
    ).toEqual({
      organizationId: null,
      intent: {
        id: "wtop_1",
        status: "cancelled",
        amount: 100,
        currency: "EUR",
      },
    });
  });

  it("rejects mismatched organization or non-cancelled status", () => {
    expect(
      confirmedWalletTopUpCancel(
        {
          organizationId: "org_other",
          intent: {
            id: "wtop_1",
            status: "cancelled",
            amount: 100,
            currency: "EUR",
          },
        },
        { intentId: "wtop_1", organizationId: "org_sellers" },
      ),
    ).toBeNull();
    expect(
      confirmedWalletTopUpCancel(
        {
          organizationId: null,
          intent: {
            id: "wtop_1",
            status: "awaiting_provider",
            amount: 100,
            currency: "EUR",
          },
        },
        { intentId: "wtop_1" },
      ),
    ).toBeNull();
  });
});
