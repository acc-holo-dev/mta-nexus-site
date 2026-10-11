import type { CommercialPlanTerms, commercialFeeEstimate } from "./commercial-plans";

export type PlanReviewCommand = {
  requestId: string;
  planId: string;
  expectedRevision: number;
  organizationId?: string;
  grossAmount: number;
  currency: "USD" | "EUR" | "RUB";
};
export type PlanReview = {
  id: string;
  planId: string;
  planRevision: number;
  scope: "user" | "organization";
  subjectId: string;
  createdAt: Date;
  terms: CommercialPlanTerms;
  estimate: ReturnType<typeof commercialFeeEstimate>;
};
export type PlanReviewDetail = {
  review: PlanReview;
  observedAt: Date;
  state: "current" | "changed" | "unavailable";
  current: { revision: number; terms: CommercialPlanTerms } | null;
};
/** Strict documented projection; unrecognized historical terms remain unavailable. */
export function readPlanReviewTerms(value: unknown): CommercialPlanTerms | null {
  if (!value || typeof value !== "object") return null;
  const t = value as Record<string, unknown>;
  const text = (v: unknown, min: number, max: number) =>
    typeof v === "string" && v.trim().length >= min && v.length <= max;
  if (
    !text(t.titleRu, 3, 100) ||
    !text(t.titleEn, 3, 100) ||
    !text(t.descriptionRu, 10, 2000) ||
    !text(t.descriptionEn, 10, 2000) ||
    !Number.isSafeInteger(t.price) ||
    (t.price as number) < 0 ||
    (t.price as number) > 100_000_000 ||
    !["USD", "EUR", "RUB"].includes(t.currency as string) ||
    ![7, 30, 90, 365].includes(t.durationDays as number) ||
    !Number.isSafeInteger(t.commissionBps) ||
    (t.commissionBps as number) < 0 ||
    (t.commissionBps as number) > 1000
  )
    return null;
  return {
    titleRu: t.titleRu as string,
    titleEn: t.titleEn as string,
    descriptionRu: t.descriptionRu as string,
    descriptionEn: t.descriptionEn as string,
    price: t.price as number,
    currency: t.currency as CommercialPlanTerms["currency"],
    durationDays: t.durationDays as CommercialPlanTerms["durationDays"],
    commissionBps: t.commissionBps as number,
  };
}
