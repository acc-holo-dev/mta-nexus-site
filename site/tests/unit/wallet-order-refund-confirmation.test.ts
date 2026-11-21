import { describe, expect, it } from "vitest";
import { confirmedWalletOrderRefund } from "../../src/features/commerce/wallet-order-refund-confirmation";

describe("confirmedWalletOrderRefund", () => {
  it("accepts a refunded wallet order response", () => {
    expect(
      confirmedWalletOrderRefund(
        {
          orderId: "ord_1",
          status: "refunded",
          totalAmount: 1000,
          currency: "EUR",
          alreadyRefunded: false,
        },
        { orderId: "ord_1" },
      ),
    ).toEqual({
      orderId: "ord_1",
      status: "refunded",
      totalAmount: 1000,
      currency: "EUR",
      alreadyRefunded: false,
    });
  });

  it("rejects mismatched order or non-refunded status", () => {
    expect(
      confirmedWalletOrderRefund(
        {
          orderId: "ord_other",
          status: "refunded",
          totalAmount: 1000,
          currency: "EUR",
          alreadyRefunded: false,
        },
        { orderId: "ord_1" },
      ),
    ).toBeNull();
    expect(
      confirmedWalletOrderRefund(
        {
          orderId: "ord_1",
          status: "completed",
          totalAmount: 1000,
          currency: "EUR",
          alreadyRefunded: false,
        },
        { orderId: "ord_1" },
      ),
    ).toBeNull();
  });
});
