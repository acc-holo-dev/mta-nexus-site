import { AppError } from "./errors";
import type { WalletCurrency } from "./wallet-payments";

/** Platform-funded checkout code. Stored uppercase. One use per buyer. */
export const PROMO_CODE_PATTERN = /^[A-Z0-9]{4,16}$/u;
export const PROMO_CLEARING_ACCOUNT = "platform:promo";

export type PromoCodeKind = "percent" | "fixed";

export type PromoCodeRecord = {
  code: string;
  kind: PromoCodeKind;
  percent: number | null;
  amount: number | null;
  currency: string | null;
  active: boolean;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type PromoQuote = {
  code: string;
  kind: PromoCodeKind;
  percent: number | null;
  listAmount: number;
  discountAmount: number;
  chargedAmount: number;
  currency: WalletCurrency;
};

export function normalizePromoCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!PROMO_CODE_PATTERN.test(code)) {
    throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
  }
  return code;
}

/**
 * Discount truth for one cart total. Lines stay at catalog prices.
 * The charged total stays at least 1 minor unit. Percent is 1–90.
 * A fixed code must use the cart currency and cannot wipe the price.
 */
export function quotePromoDiscount(input: {
  listAmount: number;
  currency: WalletCurrency;
  promo: PromoCodeRecord;
  now: Date;
}): PromoQuote {
  const promo = input.promo;
  if (!PROMO_CODE_PATTERN.test(promo.code)) {
    throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
  }
  if (!promo.active) throw new AppError("Promo code is inactive", 409, "PROMO_INACTIVE");
  if (promo.startsAt && promo.startsAt.getTime() > input.now.getTime()) {
    throw new AppError("Promo code has not started", 409, "PROMO_NOT_STARTED");
  }
  if (promo.endsAt && promo.endsAt.getTime() <= input.now.getTime()) {
    throw new AppError("Promo code has expired", 409, "PROMO_EXPIRED");
  }
  if (
    promo.maxRedemptions !== null &&
    (!Number.isSafeInteger(promo.maxRedemptions) || promo.redemptionCount >= promo.maxRedemptions)
  ) {
    throw new AppError("Promo code is exhausted", 409, "PROMO_EXHAUSTED");
  }
  if (
    !Number.isSafeInteger(input.listAmount) ||
    input.listAmount <= 1 ||
    input.listAmount > 100_000_000
  ) {
    throw new AppError("Promo code does not fit this price", 409, "PROMO_EXCEEDS_PRICE");
  }

  let discount = 0;
  if (promo.kind === "percent") {
    if (
      !Number.isSafeInteger(promo.percent) ||
      promo.percent === null ||
      promo.percent < 1 ||
      promo.percent > 90
    ) {
      throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
    }
    discount = Math.floor((input.listAmount * promo.percent) / 100);
  } else if (promo.kind === "fixed") {
    if (promo.currency !== input.currency) {
      throw new AppError("Promo code currency does not match", 409, "PROMO_CURRENCY_MISMATCH");
    }
    if (!Number.isSafeInteger(promo.amount) || promo.amount === null || promo.amount <= 0) {
      throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
    }
    discount = promo.amount;
  } else {
    throw new AppError("Promo code is invalid", 400, "PROMO_INVALID");
  }

  const charged = input.listAmount - discount;
  if (discount <= 0 || charged < 1) {
    throw new AppError("Promo code does not fit this price", 409, "PROMO_EXCEEDS_PRICE");
  }
  return {
    code: promo.code,
    kind: promo.kind,
    percent: promo.kind === "percent" ? promo.percent : null,
    listAmount: input.listAmount,
    discountAmount: discount,
    chargedAmount: charged,
    currency: input.currency,
  };
}

/** Stored order fields that explain a charged total below the catalog sum. */
export function readOrderPromoTruth(order: {
  totalAmount: number;
  listAmount?: number | null;
  discountAmount?: number | null;
  promoCode?: string | null;
}): { code: string; listAmount: number; discountAmount: number } | null {
  const list = order.listAmount ?? null;
  const discount = order.discountAmount ?? null;
  const code = order.promoCode ?? null;
  if (list === null && discount === null && code === null) return null;
  if (
    list === null ||
    discount === null ||
    code === null ||
    !PROMO_CODE_PATTERN.test(code) ||
    !Number.isSafeInteger(list) ||
    !Number.isSafeInteger(discount) ||
    !Number.isSafeInteger(order.totalAmount) ||
    discount <= 0 ||
    discount >= list ||
    list - discount !== order.totalAmount ||
    order.totalAmount < 1
  ) {
    throw new AppError("Invalid pending order", 400, "ORDER_TERMS_INVALID");
  }
  return { code, listAmount: list, discountAmount: discount };
}
