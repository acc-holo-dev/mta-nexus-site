import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletWithdrawal = {
  organizationId: string | null;
  intent: {
    id: string;
    status: string;
    amount: number;
    currency: WalletCurrency;
    providerId: string;
    escrowAccountId: string;
  };
};

/** Narrow untrusted POST /api/wallet/withdrawals JSON before showing success UI. */
export function confirmedWalletWithdrawal(
  value: unknown,
  expected: {
    amount: number;
    currency: WalletCurrency;
    providerId: string;
    organizationId?: string;
  },
): ConfirmedWalletWithdrawal | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const intent = body.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
  const row = intent as Record<string, unknown>;
  const expectedOrganizationId = expected.organizationId ?? null;
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
    row.providerId !== expected.providerId ||
    typeof row.escrowAccountId !== "string" ||
    row.escrowAccountId.length < 8 ||
    row.escrowAccountId.length > 160 ||
    (expectedOrganizationId === null
      ? body.organizationId !== null && body.organizationId !== undefined
      : body.organizationId !== expectedOrganizationId)
  ) {
    return null;
  }
  return {
    organizationId: expectedOrganizationId,
    intent: {
      id: row.id,
      status: row.status,
      amount: row.amount,
      currency: expected.currency,
      providerId: expected.providerId,
      escrowAccountId: row.escrowAccountId,
    },
  };
}
