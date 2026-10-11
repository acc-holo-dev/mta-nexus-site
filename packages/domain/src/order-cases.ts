import type { SupportCaseStatus } from "./entities";
export const ORDER_CASE_KINDS = [
  "payment_issue",
  "resource_issue",
  "refund_request",
  "dispute",
] as const;
export const ORDER_CASE_REVIEW_STATUSES = [
  "intake",
  "reviewing",
  "awaiting_buyer",
  "refund_recommended",
  "refund_declined",
  "resolved",
  "dismissed",
] as const;
export type OrderCaseKind = (typeof ORDER_CASE_KINDS)[number];
export type OrderCaseReviewStatus = (typeof ORDER_CASE_REVIEW_STATUSES)[number];
export type OrderCaseCreate = {
  requestId: string;
  kind: OrderCaseKind;
  subject: string;
  message: string;
  requestedAmount: number | null;
};
export type OrderCaseReview = {
  action:
    | "start_review"
    | "request_info"
    | "recommend_refund"
    | "decline_refund"
    | "resolve"
    | "dismiss"
    | "reopen";
  expectedRevision: number;
  expectedSupportUpdatedAt: string;
  expectedEvidenceHash: string;
  notes: string;
};
export interface OrderCaseEvidence {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  totalAmount: number;
  currency: string;
  itemCount: number;
  paymentCount: number;
  recordedCaptureCount: number;
  recordedMatchingCaptureCount: number;
  refundedRecordCount: number;
  disputedRecordCount: number;
  payments: {
    recordKey: string;
    status: string;
    amount: number;
    currency: string;
    createdAt: string;
    updatedAt: string;
  }[];
  capturedAt: string;
  confirmation: "recorded_only";
}
export interface OrderCaseView {
  id: string;
  orderId: string;
  kind: OrderCaseKind;
  reviewStatus: OrderCaseReviewStatus;
  revision: number;
  requestedAmount: number | null;
  currency: string;
  createdAt: Date;
  subject: string;
  threadStatus: SupportCaseStatus;
  supportUpdatedAt: Date;
}
export function orderCaseReviewTarget(action: OrderCaseReview["action"]): OrderCaseReviewStatus {
  return {
    start_review: "reviewing",
    request_info: "awaiting_buyer",
    recommend_refund: "refund_recommended",
    decline_refund: "refund_declined",
    resolve: "resolved",
    dismiss: "dismissed",
    reopen: "reviewing",
  }[action] as OrderCaseReviewStatus;
}
