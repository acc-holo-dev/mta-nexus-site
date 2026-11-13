import {
  orderCaseReviewTarget,
  type OrderCaseReview,
  type OrderCaseReviewStatus,
} from "@nexus/domain";

export function parseOrderCaseAmount(value: string, total: number): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\d{1,10}(?:[.,]\d{1,2})?$/u.test(value.trim())) return undefined;
  const [whole, fraction = ""] = value.trim().replace(",", ".").split(".");
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 && amount <= total && amount <= 2147483647
    ? amount
    : undefined;
}
export function confirmOrderCaseCreated(
  value: unknown,
  orderId: string,
  requestId: string,
): string | null {
  if (typeof value !== "object" || value === null) return null;
  const x = value as Record<string, unknown>;
  return x.kind === "order_case_created" &&
    x.orderId === orderId &&
    x.requestId === requestId &&
    typeof x.replayed === "boolean" &&
    typeof x.caseId === "string" &&
    /^sup_[a-f0-9]{24}$/u.test(x.caseId)
    ? x.caseId
    : null;
}
export function confirmOrderCaseReviewed(
  value: unknown,
  caseId: string,
  command: OrderCaseReview,
  prior: OrderCaseReviewStatus,
): boolean {
  if (typeof value !== "object" || value === null) return false;
  const x = value as Record<string, unknown>,
    target = orderCaseReviewTarget(command.action);
  const timestamp = x.supportUpdatedAt;
  return (
    x.kind === "order_case_reviewed" &&
    x.caseId === caseId &&
    x.action === command.action &&
    x.reviewStatus === target &&
    x.revision === command.expectedRevision + (target === prior ? 0 : 1) &&
    x.financialExecution === false &&
    x.threadStatus ===
      (["decline_refund", "resolve", "dismiss"].includes(command.action) ? "resolved" : "open") &&
    typeof timestamp === "string" &&
    Number.isFinite(Date.parse(timestamp)) &&
    new Date(timestamp).toISOString() === timestamp &&
    Date.parse(timestamp) > Date.parse(command.expectedSupportUpdatedAt)
  );
}
