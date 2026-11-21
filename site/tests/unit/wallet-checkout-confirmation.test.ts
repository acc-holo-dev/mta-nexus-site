import { describe, expect, it } from "vitest";
import { confirmedWalletCheckout } from "../../src/features/commerce/wallet-checkout-confirmation";

describe("confirmedWalletCheckout", () => {
  it("requires an order number on top of the wallet pay receipt", () => {
    expect(
      confirmedWalletCheckout({
        orderId: "ord_a",
        paymentId: "pay_wallet_ord_a",
        ledgerBatchId: "wspend_ord_a",
        status: "completed",
        totalAmount: 500,
        currency: "USD",
        alreadySettled: false,
        orderNumber: "NEXUS-A1",
      }),
    ).toMatchObject({ orderId: "ord_a", orderNumber: "NEXUS-A1" });

    expect(
      confirmedWalletCheckout({
        orderId: "ord_a",
        paymentId: "pay_wallet_ord_a",
        ledgerBatchId: "wspend_ord_a",
        status: "completed",
        totalAmount: 500,
        currency: "USD",
        alreadySettled: false,
      }),
    ).toBeNull();
  });
});
