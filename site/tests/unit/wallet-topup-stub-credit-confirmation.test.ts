import { describe, expect, it } from "vitest";
import { confirmedWalletTopUpStubCredit } from "../../src/features/commerce/wallet-topup-stub-credit-confirmation";

describe("confirmedWalletTopUpStubCredit", () => {
  it("accepts a matching stub top-up success response", () => {
    expect(
      confirmedWalletTopUpStubCredit(
        {
          organizationId: null,
          kind: "topup_succeeded",
          credited: true,
          intent: {
            id: "pay_stub_1",
            status: "succeeded",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "pay_stub_1", outcome: "succeeded" },
      ),
    ).toMatchObject({
      kind: "topup_succeeded",
      credited: true,
      intent: { id: "pay_stub_1", status: "succeeded" },
    });
  });

  it("accepts a matching stub top-up failure response", () => {
    expect(
      confirmedWalletTopUpStubCredit(
        {
          organizationId: "org_sellers",
          kind: "topup_failed",
          credited: false,
          intent: {
            id: "pay_stub_2",
            status: "failed",
            amount: 500,
            currency: "EUR",
          },
        },
        {
          intentId: "pay_stub_2",
          outcome: "failed",
          organizationId: "org_sellers",
        },
      ),
    ).toMatchObject({
      organizationId: "org_sellers",
      kind: "topup_failed",
      credited: false,
    });
  });

  it("rejects outcome/status mismatch", () => {
    expect(
      confirmedWalletTopUpStubCredit(
        {
          organizationId: null,
          kind: "topup_succeeded",
          credited: true,
          intent: {
            id: "pay_stub_3",
            status: "failed",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "pay_stub_3", outcome: "succeeded" },
      ),
    ).toBeNull();
  });
});
