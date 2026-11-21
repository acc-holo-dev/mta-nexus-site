export type ConfirmedWalletBalance = {
  accountId: string;
  organizationId: string | null;
  currency: string;
  available: number;
};

export function confirmedWalletBalance(value: unknown): ConfirmedWalletBalance | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.accountId !== "string" ||
    row.accountId.length < 1 ||
    row.accountId.length > 128 ||
    typeof row.currency !== "string" ||
    row.currency.length < 3 ||
    row.currency.length > 8 ||
    typeof row.available !== "number" ||
    !Number.isSafeInteger(row.available) ||
    row.available < 0
  ) {
    return null;
  }
  if (row.organizationId !== null && typeof row.organizationId !== "string") return null;
  if (typeof row.organizationId === "string" && row.organizationId.length > 128) return null;
  return {
    accountId: row.accountId,
    organizationId: row.organizationId,
    currency: row.currency,
    available: row.available,
  };
}
