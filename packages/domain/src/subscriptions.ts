import type { CommercialPlanTerms } from "./commercial-plans";
import { readPlanReviewTerms } from "./plan-reviews";
export type SubscriptionCommand =
  | {
      action: "activate";
      requestId: string;
      planId: string;
      expectedRevision: number;
      organizationId?: string;
    }
  | { action: "cancel"; requestId: string; subscriptionId: string; organizationId?: string };
export type AccountSubscription = {
  id: string;
  subjectType: "user" | "organization";
  subjectId: string;
  planId: string;
  planRevision: number;
  terms: CommercialPlanTerms;
  startedAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
  status: "active" | "expired" | "cancelled";
};
export type SubscriptionReceipt = {
  id: string;
  action: "activate" | "cancel";
  createdAt: Date;
  subscription: AccountSubscription;
};
export const FREE_SUBSCRIPTION_LIMIT = 500;
export function effectiveSubscriptionStatus(
  status: string,
  expiresAt: Date,
  observedAt: Date,
): AccountSubscription["status"] | null {
  if (
    !["active", "expired", "cancelled"].includes(status) ||
    !Number.isFinite(expiresAt.getTime()) ||
    !Number.isFinite(observedAt.getTime())
  )
    return null;
  return status === "cancelled"
    ? "cancelled"
    : status === "expired" || expiresAt <= observedAt
      ? "expired"
      : "active";
}
export function readSubscriptionSnapshot(value: unknown): AccountSubscription | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const s = value as Record<string, unknown>,
    terms = readPlanReviewTerms(s.terms);
  const id = (v: unknown) =>
    typeof v === "string" && v.trim() === v && /^[A-Za-z0-9_-]{1,160}$/u.test(v);
  const date = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v)) ? new Date(v) : null;
  const startedAt = date(s.startedAt),
    expiresAt = date(s.expiresAt),
    cancelledAt = s.cancelledAt === null ? null : date(s.cancelledAt);
  if (
    s.version !== 1 ||
    !id(s.id) ||
    !id(s.subjectId) ||
    !id(s.planId) ||
    !["user", "organization"].includes(String(s.subjectType)) ||
    !Number.isSafeInteger(s.planRevision) ||
    (s.planRevision as number) < 1 ||
    !["active", "expired", "cancelled"].includes(String(s.status)) ||
    !terms ||
    terms.price !== 0 ||
    !startedAt ||
    !expiresAt ||
    expiresAt.getTime() - startedAt.getTime() !== terms.durationDays * 86400000 ||
    (s.status === "cancelled"
      ? !cancelledAt || cancelledAt < startedAt || cancelledAt >= expiresAt
      : s.cancelledAt !== null)
  )
    return null;
  return {
    id: s.id as string,
    subjectType: s.subjectType as AccountSubscription["subjectType"],
    subjectId: s.subjectId as string,
    planId: s.planId as string,
    planRevision: s.planRevision as number,
    terms,
    startedAt,
    expiresAt,
    cancelledAt,
    status: s.status as AccountSubscription["status"],
  };
}
