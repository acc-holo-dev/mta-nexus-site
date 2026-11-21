import { describe, expect, it } from "vitest";
import { confirmedWalletPay } from "../../src/features/commerce/wallet-pay-confirmation";

describe("confirmedWalletPay", () => {
  it("accepts a completed wallet settlement receipt", () => {
    expect(
      confirmedWalletPay({
        orderId: "ord_a",
        paymentId: "pay_wallet_ord_a",
        ledgerBatchId: "wspend_ord_a",
        status: "completed",
        totalAmount: 500,
        currency: "USD",
        alreadySettled: false,
      }),
    ).toEqual({
      orderId: "ord_a",
      paymentId: "pay_wallet_ord_a",
      ledgerBatchId: "wspend_ord_a",
      status: "completed",
      totalAmount: 500,
      currency: "USD",
      alreadySettled: false,
    });
  });

  it("rejects incomplete or unsafe receipts", () => {
    expect(confirmedWalletPay(null)).toBeNull();
    expect(
      confirmedWalletPay({
        orderId: "ord_a",
        paymentId: "pay_wallet_ord_a",
        ledgerBatchId: "wspend_ord_a",
        status: "pending",
        totalAmount: 500,
        currency: "USD",
        alreadySettled: false,
      }),
    ).toBeNull();
    expect(
      confirmedWalletPay({
        orderId: "ord_a",
        paymentId: "pay_wallet_ord_a",
        ledgerBatchId: "wspend_ord_a",
        status: "completed",
        totalAmount: 1.5,
        currency: "USD",
        alreadySettled: false,
      }),
    ).toBeNull();
  });
});
