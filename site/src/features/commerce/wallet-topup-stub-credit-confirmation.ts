import type { WalletCurrency } from "@nexus/domain";

export type ConfirmedWalletTopUpStubCredit = {
  organizationId: string | null;
  kind: "topup_succeeded" | "topup_failed";
  credited: boolean;
  intent: {
    id: string;
    status: string;
    amount: number;
    currency: WalletCurrency;
  };
};

/** Narrow untrusted POST /api/wallet/topups/:id/stub-credit JSON. */
export function confirmedWalletTopUpStubCredit(
  value: unknown,
  expected: {
    intentId: string;
    outcome: "succeeded" | "failed";
    organizationId?: string;
  },
): ConfirmedWalletTopUpStubCredit | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;
  const intent = body.intent;
  if (!intent || typeof intent !== "object" || Array.isArray(intent)) return null;
  const row = intent as Record<string, unknown>;
  const expectedOrganizationId = expected.organizationId ?? null;
  const expectedKind = expected.outcome === "succeeded" ? "topup_succeeded" : "topup_failed";
  const expectedStatus = expected.outcome === "succeeded" ? "succeeded" : "failed";
  if (
    typeof row.id !== "string" ||
    row.id !== expected.intentId ||
    row.status !== expectedStatus ||
    body.kind !== expectedKind ||
    typeof body.credited !== "boolean" ||
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
    credited: body.credited,
    intent: {
      id: row.id,
      status: expectedStatus,
      amount: row.amount,
      currency: row.currency as WalletCurrency,
    },
  };
}
