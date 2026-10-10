import { commercialPlanTermsSchema } from "@nexus/validation";
import {
  commercialFeeEstimate,
  commercialPlanTransition,
  type CommercialPlan,
  type CommercialPlanCommand,
} from "@nexus/domain";
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
export function commercialTerms(
  plan: Pick<
    CommercialPlan,
    | "titleRu"
    | "titleEn"
    | "descriptionRu"
    | "descriptionEn"
    | "price"
    | "currency"
    | "durationDays"
    | "commissionBps"
  >,
) {
  return {
    titleRu: plan.titleRu,
    titleEn: plan.titleEn,
    descriptionRu: plan.descriptionRu,
    descriptionEn: plan.descriptionEn,
    price: plan.price,
    currency: plan.currency,
    durationDays: plan.durationDays,
    commissionBps: plan.commissionBps,
  };
}
export function confirmedCommercialPlan(
  value: unknown,
  command: CommercialPlanCommand,
  previous?: Omit<CommercialPlan, "updatedAt">,
): { id: string } | null {
  if (!record(value) || !record(value.plan)) return null;
  const plan = value.plan;
  if (
    typeof plan.id !== "string" ||
    !/^cplan_[A-Za-z0-9_-]{1,100}$/u.test(plan.id) ||
    plan.revision !== (command.action === "create" ? 1 : command.expectedRevision + 1)
  )
    return null;
  if (command.action === "create") {
    if (plan.slug !== command.slug || plan.scope !== command.scope || plan.status !== "draft")
      return null;
  } else if (
    !previous ||
    plan.id !== previous.id ||
    plan.slug !== previous.slug ||
    plan.scope !== previous.scope ||
    plan.status !== commercialPlanTransition(previous.status, command.action)
  )
    return null;
  const candidate = commercialPlanTermsSchema.safeParse({
    titleRu: plan.titleRu,
    titleEn: plan.titleEn,
    descriptionRu: plan.descriptionRu,
    descriptionEn: plan.descriptionEn,
    price: plan.price,
    currency: plan.currency,
    durationDays: plan.durationDays,
    commissionBps: plan.commissionBps,
  });
  if (!candidate.success) return null;
  const expected =
    command.action === "create" || command.action === "save"
      ? command.terms
      : previous
        ? commercialTerms(previous)
        : null;
  if (
    !expected ||
    Object.keys(expected).some(
      (key) =>
        candidate.data[key as keyof typeof candidate.data] !==
        expected[key as keyof typeof expected],
    )
  )
    return null;
  return { id: plan.id };
}
export function parseCommercialAmount(value: string): number | null {
  const match = /^(0|[1-9]\d{0,6})(?:[.,](\d{1,2}))?$/u.exec(value.trim());
  if (!match) return null;
  const amount = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return amount <= 100_000_000 ? amount : null;
}
export function confirmedCommercialEstimate(
  value: unknown,
  amount: number,
  currency: "USD" | "EUR" | "RUB",
  selected?: { id: string; revision: number; commissionBps: number },
) {
  if (!record(value) || value.kind !== "estimate") return null;
  const expected = commercialFeeEstimate(amount, currency, selected?.commissionBps);
  if (Object.keys(expected).some((key) => value[key] !== expected[key as keyof typeof expected]))
    return null;
  if (
    selected
      ? !record(value.plan) ||
        value.plan.id !== selected.id ||
        value.plan.revision !== selected.revision
      : value.plan !== null
  )
    return null;
  return expected;
}
export function confirmedOrderCancellation(
  value: unknown,
  orderId: string,
  requestId: string,
): boolean {
  return (
    record(value) &&
    value.kind === "unpaid_order_cancelled" &&
    value.orderId === orderId &&
    value.requestId === requestId &&
    typeof value.cancelledAt === "string" &&
    Number.isFinite(Date.parse(value.cancelledAt)) &&
    new Date(value.cancelledAt).toISOString() === value.cancelledAt
  );
}
