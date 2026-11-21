export type ConfirmedWalletPay = {
  orderId: string;
  paymentId: string;
  ledgerBatchId: string;
  status: "completed";
  totalAmount: number;
  currency: string;
  alreadySettled: boolean;
};

export function confirmedWalletPay(value: unknown): ConfirmedWalletPay | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.orderId !== "string" ||
    typeof row.paymentId !== "string" ||
    typeof row.ledgerBatchId !== "string" ||
    row.status !== "completed" ||
    !Number.isSafeInteger(row.totalAmount) ||
    typeof row.currency !== "string" ||
    typeof row.alreadySettled !== "boolean"
  ) {
    return null;
  }
  return {
    orderId: row.orderId,
    paymentId: row.paymentId,
    ledgerBatchId: row.ledgerBatchId,
    status: "completed",
    totalAmount: row.totalAmount as number,
    currency: row.currency,
    alreadySettled: row.alreadySettled,
  };
}
