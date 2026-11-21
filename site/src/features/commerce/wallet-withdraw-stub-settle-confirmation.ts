import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletWithdrawalStubSettle = {
  organizationId: string | null;
  kind: "payout_succeeded" | "payout_failed";
  settled: boolean;
  intent: {
    id: string;
    status: string;
    amount: number;
    currency: WalletCurrency;
  };
};

/** Narrow untrusted POST /api/wallet/withdrawals/:id/stub-settle JSON. */
export function confirmedWalletWithdrawalStubSettle(
  value: unknown,
  expected: {
    intentId: string;
    outcome: "succeeded" | "failed";
    organizationId?: string;
  },
): ConfirmedWalletWithdrawalStubSettle | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const intent = body.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
  const row = intent as Record<string, unknown>;
  const expectedOrganizationId = expected.organizationId ?? null;
  const expectedKind = expected.outcome === "succeeded" ? "payout_succeeded" : "payout_failed";
  const expectedStatus = expected.outcome === "succeeded" ? "succeeded" : "failed";
  if (
    typeof row.id !== "string" ||
    row.id !== expected.intentId ||
    row.status !== expectedStatus ||
    body.kind !== expectedKind ||
    typeof body.settled !== "boolean" ||
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
    kind: expectedKind,
    settled: body.settled,
    intent: {
      id: row.id,
      status: expectedStatus,
      amount: row.amount,
      currency: row.currency as WalletCurrency,
    },
  };
}
