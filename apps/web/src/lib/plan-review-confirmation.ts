import {
  type CommercialPlanTerms,
  commercialFeeEstimate,
  type PlanReviewCommand,
  readPlanReviewTerms,
} from "@nexus/domain";
export function confirmedPlanReview(
  body: unknown,
  command: PlanReviewCommand,
  actorId: string,
  expectedTerms: CommercialPlanTerms,
): string | null {
  if (
    !body ||
    typeof body !== "object" ||
    !("review" in body) ||
    !body.review ||
    typeof body.review !== "object"
  )
    return null;
  const r = body.review as Record<string, unknown>,
    terms = readPlanReviewTerms(r.terms);
  if (
    typeof r.id !== "string" ||
    !/^prev_[a-f0-9]{64}$/u.test(r.id) ||
    r.planId !== command.planId ||
    r.planRevision !== command.expectedRevision ||
    r.scope !== (command.organizationId ? "organization" : "user") ||
    r.subjectId !== (command.organizationId ?? actorId) ||
    typeof r.createdAt !== "string" ||
    !Number.isFinite(Date.parse(r.createdAt)) ||
    new Date(r.createdAt).toISOString() !== r.createdAt ||
    !terms ||
    Object.keys(expectedTerms).some(
      (key) =>
        terms[key as keyof CommercialPlanTerms] !== expectedTerms[key as keyof CommercialPlanTerms],
    )
  )
    return null;
  const expected = commercialFeeEstimate(
      command.grossAmount,
      command.currency,
      terms.commissionBps,
    ),
    estimate = r.estimate;
  if (
    !estimate ||
    typeof estimate !== "object" ||
    Object.entries(expected).some(([key, v]) => (estimate as Record<string, unknown>)[key] !== v)
  )
    return null;
  return r.id;
}
