import { type ConfirmedWalletPay, confirmedWalletPay } from "./wallet-pay-confirmation";

export type ConfirmedWalletCheckout = ConfirmedWalletPay & { orderNumber: string };

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
  return { ...base, orderNumber: row.orderNumber };
}
