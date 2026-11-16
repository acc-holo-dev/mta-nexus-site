/** Current-portfolio observations, never payment verification or payout authority. */
export const SELLER_SALES_EVIDENCE = [
  "free",
  "capture_recorded",
  "refund_recorded",
  "dispute_recorded",
  "review",
] as const;
export type SellerSaleEvidence = (typeof SELLER_SALES_EVIDENCE)[number];
export type SellerSalesQuery = {
  page: number;
  attribution?: "portfolio" | "recorded";
  days: "all" | 7 | 30 | 90 | 365;
  status: "completed" | "refunded" | "all";
  evidence: "all" | SellerSaleEvidence;
  currency?: "USD" | "EUR" | "RUB";
  organizationId?: string;
  productId?: string;
};
export type SellerSale = {
  id: string;
  productId: string;
  productTitle: string;
  orderNumber: string;
  status: "completed" | "refunded";
  unitPrice: number;
  currency: string;
  createdAt: Date;
  evidence: SellerSaleEvidence;
  inCurrentPortfolio?: boolean;
  titleSource?: "current" | "recorded";
};
export type SellerSalesTotal = {
  currency: string;
  lines: number;
  orders: number;
  gross: string | null;
  reviewLines: number;
};
export type SellerSalesReport = {
  scope: { id: string; name: string | null };
  product: { id: string; title: string } | null;
  observedAt: Date;
  sales: SellerSale[];
  totals: SellerSalesTotal[];
  periods: { period: string; currency: string; lines: number; gross: string | null }[];
  periodUnit: "day" | "month";
  periodStart: Date;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
/** A record is deliberately not called paid/settled/verified. */
export function sellerSaleEvidence(input: {
  orderAmount: number;
  lineAmount: number;
  orderCurrency: string;
  lineCurrency: string;
  orderStatus: string;
  attempts: number;
  captures: number;
  completed: number;
  refunds: number;
  disputes: number;
  mismatch: boolean;
}): SellerSaleEvidence {
  if (
    !["USD", "EUR", "RUB"].includes(input.orderCurrency) ||
    input.lineCurrency !== input.orderCurrency ||
    !Number.isSafeInteger(input.orderAmount) ||
    input.orderAmount < 0 ||
    !Number.isSafeInteger(input.lineAmount) ||
    input.lineAmount < 0 ||
    input.lineAmount > input.orderAmount ||
    input.mismatch
  )
    return "review";
  if (input.orderAmount === 0)
    return input.lineAmount === 0 && input.attempts === 0 && input.orderStatus === "completed"
      ? "free"
      : "review";
  if (input.captures !== 1) return "review";
  if (input.disputes === 1) return "dispute_recorded";
  if (input.refunds === 1) return "refund_recorded";
  return input.completed === 1 && input.orderStatus === "completed" ? "capture_recorded" : "review";
}
export function sellerSalesWindow(days: SellerSalesQuery["days"], observedAt: Date) {
  const cutoff = days === "all" ? null : new Date(observedAt.getTime() - days * 86_400_000);
  const periodUnit = days === 7 || days === 30 ? "day" : "month";
  // All-time totals remain all-time; the period table is explicitly the latest twelve UTC months.
  const periodStart =
    cutoff ?? new Date(Date.UTC(observedAt.getUTCFullYear(), observedAt.getUTCMonth() - 11, 1));
  return { cutoff, periodStart, periodUnit } as const;
}
