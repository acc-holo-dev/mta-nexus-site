import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildWalletOrderRefundPosting,
  buildWalletSpendPosting,
  quotePromoDiscount,
  readOrderPromoTruth,
  validateLedgerPosting,
} from "@nexus/domain";
import { describe, expect, it } from "vitest";

const now = new Date("2026-11-24T18:00:00.000Z");

const percent = {
  code: "LAUNCH10",
  kind: "percent" as const,
  percent: 10,
  amount: null,
  currency: null,
  active: true,
  maxRedemptions: 100,
  redemptionCount: 0,
  startsAt: null,
  endsAt: null,
};

describe("promo quotes", () => {
  it("shows the catalog total, the discount, and a charged remainder", () => {
    expect(
      quotePromoDiscount({ listAmount: 1000, currency: "RUB", promo: percent, now }),
    ).toMatchObject({
      code: "LAUNCH10",
      listAmount: 1000,
      discountAmount: 100,
      chargedAmount: 900,
    });
  });

  it("rejects a code that would wipe the price", () => {
    expect(() =>
      quotePromoDiscount({
        listAmount: 1000,
        currency: "RUB",
        promo: { ...percent, kind: "fixed", percent: null, amount: 1000, currency: "RUB" },
        now,
      }),
    ).toThrow(/payable|fit this price|PROMO_EXCEEDS_PRICE/i);
  });

  it("rejects a fixed code in another currency", () => {
    expect(() =>
      quotePromoDiscount({
        listAmount: 1000,
        currency: "USD",
        promo: { ...percent, kind: "fixed", percent: null, amount: 100, currency: "EUR" },
        now,
      }),
    ).toThrow(/currency/i);
  });

  it("keeps an order without a code on the catalog sum", () => {
    expect(readOrderPromoTruth({ totalAmount: 1000 })).toBeNull();
    expect(
      readOrderPromoTruth({
        totalAmount: 900,
        listAmount: 1000,
        discountAmount: 100,
        promoCode: "LAUNCH10",
      }),
    ).toEqual({ code: "LAUNCH10", listAmount: 1000, discountAmount: 100 });
  });

  it("funds the discount from the platform without changing the seller gross", () => {
    const entries = buildWalletSpendPosting({
      accountId: "user:usr_buyer",
      amount: 900,
      currency: "RUB",
      orderId: "ord_promo_1",
      availableBalance: 900,
      userEntryId: "leg_promo_u",
      platformFeeEntryId: "leg_promo_fee",
      platformFee: 100,
      promoFunding: { amount: 100, entryId: "leg_promo_gap", code: "LAUNCH10" },
      sellerHolds: [
        {
          sellerAccountId: "user:usr_seller",
          escrowAccountId: "escrow:wspend_ord_promo_1_seller",
          amount: 900,
          entryId: "leg_promo_h",
        },
      ],
    });
    expect(() => validateLedgerPosting(entries)).not.toThrow();
    expect(entries.find((entry) => entry.accountId === "platform:promo")?.amount).toBe(-100);
    expect(entries.find((entry) => entry.accountId === "user:usr_buyer")?.amount).toBe(-900);

    const refund = buildWalletOrderRefundPosting({
      orderId: "ord_promo_1",
      buyerAccountId: "user:usr_buyer",
      amount: 900,
      currency: "RUB",
      platformFee: 100,
      buyerEntryId: "leg_refund_b",
      platformFeeEntryId: "leg_refund_fee",
      promoRestore: { amount: 100, entryId: "leg_refund_gap", code: "LAUNCH10" },
      holds: [
        {
          id: "whold_1",
          sellerAccountId: "user:usr_seller",
          escrowAccountId: "escrow:wspend_ord_promo_1_seller",
          amount: 900,
          status: "held",
          entryId: "leg_refund_h",
        },
      ],
    });
    expect(() => validateLedgerPosting(refund)).not.toThrow();
    expect(refund.find((entry) => entry.accountId === "platform:promo")?.amount).toBe(100);
  });

  it("records the promo tables in the forward migration", () => {
    const sql = readFileSync(
      resolve(process.cwd(), "site/packages/db/migrations/0096_promo_codes.sql"),
      "utf8",
    );
    expect(sql).toContain("CREATE TABLE promo_codes");
    expect(sql).toContain("promo_redemptions_buyer_code_idx");
    expect(sql).toContain("orders_promo_truth_check");
  });
});
