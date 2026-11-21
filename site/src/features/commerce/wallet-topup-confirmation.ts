import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletTopUp = {
  intent: {
    id: string;
    status: string;
    amount: number;
    currency: WalletCurrency;
    providerId: string;
    createdAt?: string;
  };
  redirectUrl: string | null;
};

/** Narrow untrusted POST /api/wallet/topups JSON before showing success UI. */
export function confirmedWalletTopUp(
  value: unknown,
  expected: { amount: number; currency: WalletCurrency; providerId: string },
): ConfirmedWalletTopUp | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const intent = body.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
  const row = intent as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    row.id.length < 8 ||
    row.id.length > 128 ||
    typeof row.status !== "string" ||
    row.status.length < 1 ||
    row.status.length > 64 ||
    typeof row.amount !== "number" ||
    !Number.isInteger(row.amount) ||
    row.amount !== expected.amount ||
    row.currency !== expected.currency ||
    typeof row.providerId !== "string" ||
    row.providerId !== expected.providerId
  ) {
    return null;
  }
  const redirectUrl = body.redirectUrl;
  if (redirectUrl !== null && typeof redirectUrl !== "string") return null;
  if (typeof redirectUrl === "string" && (redirectUrl.length < 1 || redirectUrl.length > 2048)) {
    return null;
  }
  return {
    intent: {
      id: row.id,
      status: row.status,
      amount: row.amount,
      currency: expected.currency,
      providerId: expected.providerId,
      ...(typeof row.createdAt === "string" ? { createdAt: row.createdAt } : {}),
    },
    redirectUrl,
  };
}
