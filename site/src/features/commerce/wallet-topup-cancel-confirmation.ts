import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletTopUpCancel = {
  organizationId: string | null;
  intent: {
    id: string;
    status: string;
    amount: number;
    currency: WalletCurrency;
  };
};

/** Narrow untrusted POST /api/wallet/topups/:id/cancel JSON before success UI. */
export function confirmedWalletTopUpCancel(
  value: unknown,
  expected: {
    intentId: string;
    organizationId?: string;
  },
): ConfirmedWalletTopUpCancel | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const intent = body.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
  const row = intent as Record<string, unknown>;
  const expectedOrganizationId = expected.organizationId ?? null;
  if (
    typeof row.id !== "string" ||
    row.id !== expected.intentId ||
    row.status !== "cancelled" ||
    typeof row.amount !== "number" ||
    !Number.isInteger(row.amount) ||
    row.amount <= 0 ||
    typeof row.currency !== "string" ||
    !["USD", "EUR", "RUB"].includes(row.currency) ||
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
      status: "cancelled",
      amount: row.amount,
      currency: row.currency as WalletCurrency,
    },
  };
}
