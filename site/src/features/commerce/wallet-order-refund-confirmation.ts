import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletOrderRefund = {
  orderId: string;
  status: "refunded";
  totalAmount: number;
  currency: WalletCurrency;
  alreadyRefunded: boolean;
};

/** Narrow untrusted POST /api/admin/commerce/wallet-orders/:orderId/refund JSON. */
export function confirmedWalletOrderRefund(
  value: unknown,
  expected: { orderId: string },
): ConfirmedWalletOrderRefund | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  if (
    typeof body.orderId !== "string" ||
    body.orderId !== expected.orderId ||
    body.status !== "refunded" ||
    typeof body.totalAmount !== "number" ||
    !Number.isInteger(body.totalAmount) ||
    body.totalAmount <= 0 ||
    typeof body.currency !== "string" ||
    !["USD", "EUR", "RUB"].includes(body.currency) ||
    typeof body.alreadyRefunded !== "boolean"
  ) {
    return null;
  }
  return {
    orderId: body.orderId,
    status: "refunded",
    totalAmount: body.totalAmount,
    currency: body.currency as WalletCurrency,
    alreadyRefunded: body.alreadyRefunded,
  };
}
