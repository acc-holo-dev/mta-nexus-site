import {
  type CommercialPlanTerms,
  commercialFeeEstimate,
  readPlanReviewTerms,
  readSubscriptionSnapshot,
  type SubscriptionCommand,
} from "@nexus/domain";

const object = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
export function confirmedSubscriptionReceipt(
  value: unknown,
  command: SubscriptionCommand,
  actorId: string,
  expected: {
    terms: CommercialPlanTerms;
    planId: string;
    planRevision: number;
    startedAt?: string;
    expiresAt?: string;
  },
) {
  const body = object(value),
    receipt = object(body?.receipt),
    raw = object(receipt?.subscription),
    subscription = readSubscriptionSnapshot({ ...raw, version: 1 });
  const expectedTerms = readPlanReviewTerms(expected.terms);
  if (
    !subscription ||
    !expectedTerms ||
    expectedTerms.price !== 0 ||
    typeof body?.replayed !== "boolean" ||
    typeof receipt?.id !== "string" ||
    !/^srec_[a-f0-9]{64}$/u.test(receipt.id) ||
    receipt.action !== command.action ||
    typeof receipt.createdAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.createdAt)) ||
    new Date(receipt.createdAt).toISOString() !== receipt.createdAt ||
    subscription.subjectType !== (command.organizationId ? "organization" : "user") ||
    subscription.subjectId !== (command.organizationId ?? actorId) ||
    subscription.planId !== expected.planId ||
    subscription.planRevision !== expected.planRevision ||
    JSON.stringify(subscription.terms) !== JSON.stringify(expectedTerms)
  )
    return null;
  if (command.action === "activate") {
    if (
      subscription.status !== "active" ||
      subscription.planId !== command.planId ||
      subscription.planRevision !== command.expectedRevision
    )
      return null;
  } else if (
    subscription.status !== "cancelled" ||
    subscription.id !== command.subscriptionId ||
    subscription.startedAt.toISOString() !== expected.startedAt ||
    subscription.expiresAt.toISOString() !== expected.expiresAt
  )
    return null;
  return receipt.id;
}
export function confirmedSubscriptionEstimate(
  value: unknown,
  amount: number,
  currency: "USD" | "EUR" | "RUB",
  accountId: string,
) {
  const body = object(value),
    estimate = object(body?.estimate);
  const scope = object(body?.scope);
  if (
    !estimate ||
    scope?.id !== accountId ||
    typeof body?.observedAt !== "string" ||
    !Number.isFinite(Date.parse(body.observedAt)) ||
    new Date(body.observedAt).toISOString() !== body.observedAt ||
    !(
      body.subscriptionId === null ||
      (typeof body.subscriptionId === "string" && /^sub_[a-f0-9]{64}$/u.test(body.subscriptionId))
    ) ||
    !Number.isSafeInteger(estimate.commissionBps)
  )
    return null;
  try {
    const expected = commercialFeeEstimate(amount, currency, estimate.commissionBps as number);
    if (!Object.entries(expected).every(([key, field]) => estimate[key] === field)) return null;
    return expected;
  } catch {
    return null;
  }
}
