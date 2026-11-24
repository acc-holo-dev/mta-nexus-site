import { type ConfirmedWalletPay, confirmedWalletPay } from "./wallet-pay-confirmation";

export type ConfirmedWalletCheckout = ConfirmedWalletPay & {
  orderNumber: string;
  promo: { code: string; listAmount: number; discountAmount: number } | null;
};

function readCheckoutPromo(
  row: Record<string, unknown>,
  charged: number,
): ConfirmedWalletCheckout["promo"] | undefined {
  if (row.promoCode == null) {
    if (row.discountAmount == null || row.discountAmount === 0) return null;
    return undefined;
  }
  if (
    typeof row.promoCode !== "string" ||
    !/^[A-Z0-9]{4,16}$/u.test(row.promoCode) ||
    !Number.isSafeInteger(row.listAmount) ||
    !Number.isSafeInteger(row.discountAmount) ||
    (row.discountAmount as number) <= 0 ||
    (row.listAmount as number) - (row.discountAmount as number) !== charged
  ) {
    return undefined;
  }
  return {
    code: row.promoCode,
    listAmount: row.listAmount as number,
    discountAmount: row.discountAmount as number,
  };
}

export function confirmedWalletCheckout(value: unknown): ConfirmedWalletCheckout | null {
  const base = confirmedWalletPay(value);
  if (!base || !value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.orderNumber !== "string" ||
    row.orderNumber.length < 1 ||
    row.orderNumber.length > 128
  ) {
    return null;
  }
  const promo = readCheckoutPromo(row, base.totalAmount);
  if (promo === undefined) return null;
  return { ...base, orderNumber: row.orderNumber, promo };
}

export type ConfirmedPromoQuote = {
  code: string;
  listAmount: number;
  discountAmount: number;
  chargedAmount: number;
  currency: string;
};

export function confirmedPromoQuote(
  value: unknown,
  expectedCode: string,
): ConfirmedPromoQuote | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    row.code !== expectedCode ||
    !/^[A-Z0-9]{4,16}$/u.test(expectedCode) ||
    !Number.isSafeInteger(row.listAmount) ||
    !Number.isSafeInteger(row.discountAmount) ||
    !Number.isSafeInteger(row.chargedAmount) ||
    typeof row.currency !== "string" ||
    (row.discountAmount as number) <= 0 ||
    (row.listAmount as number) - (row.discountAmount as number) !== row.chargedAmount
  ) {
    return null;
  }
  return {
    code: expectedCode,
    listAmount: row.listAmount as number,
    discountAmount: row.discountAmount as number,
    chargedAmount: row.chargedAmount as number,
    currency: row.currency,
  };
}
