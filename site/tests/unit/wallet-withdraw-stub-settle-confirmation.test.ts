import { describe, expect, it } from "vitest";
import { confirmedWalletWithdrawalStubSettle } from "../../src/features/commerce/wallet-withdraw-stub-settle-confirmation";

describe("confirmedWalletWithdrawalStubSettle", () => {
  it("accepts a matching stub payout success response", () => {
    expect(
      confirmedWalletWithdrawalStubSettle(
        {
          organizationId: null,
          kind: "payout_succeeded",
          settled: true,
          intent: {
            id: "wwd_stub_1",
            status: "succeeded",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "wwd_stub_1", outcome: "succeeded" },
      ),
    ).toMatchObject({
      kind: "payout_succeeded",
      settled: true,
      intent: { id: "wwd_stub_1", status: "succeeded" },
    });
  });

  it("accepts a matching stub payout failure response", () => {
    expect(
      confirmedWalletWithdrawalStubSettle(
        {
          organizationId: "org_sellers",
          kind: "payout_failed",
          settled: true,
          intent: {
            id: "wwd_stub_2",
            status: "failed",
            amount: 500,
            currency: "EUR",
          },
        },
        {
          intentId: "wwd_stub_2",
          outcome: "failed",
          organizationId: "org_sellers",
        },
      ),
    ).toMatchObject({
      organizationId: "org_sellers",
      kind: "payout_failed",
      intent: { status: "failed" },
    });
  });

  it("rejects outcome/status mismatch", () => {
    expect(
      confirmedWalletWithdrawalStubSettle(
        {
          organizationId: null,
          kind: "payout_succeeded",
          settled: true,
          intent: {
            id: "wwd_stub_3",
            status: "failed",
            amount: 1000,
            currency: "EUR",
          },
        },
        { intentId: "wwd_stub_3", outcome: "succeeded" },
      ),
    ).toBeNull();
  });
});
