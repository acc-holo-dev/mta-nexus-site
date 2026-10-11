import type { Order, OrderItem } from "./entities";
import { AppError } from "./errors";
export const ORDER_TERMS_LINE_LIMIT = 20;
export type OrderLineTerms = {
  version: 1;
  recordedAt: string;
  product: { id: string; title: string; slug: string };
  seller: { type: "user" | "organization"; id: string };
  line: { unitPrice: number; currency: string };
  baseline: { commissionBps: 1000; holdDays: 7; licenseModel: string };
};
/** Whitelist projection: neither unknown versions nor arbitrary JSON reach a receipt. */
export function readOrderLineTerms(value: unknown): OrderLineTerms | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>,
    p = v.product as Record<string, unknown> | undefined,
    s = v.seller as Record<string, unknown> | undefined,
    l = v.line as Record<string, unknown> | undefined,
    b = v.baseline as Record<string, unknown> | undefined;
  const bounded = (x: unknown, max: number): x is string =>
    typeof x === "string" && x.length > 0 && x.length <= max;
  if (
    v.version !== 1 ||
    !bounded(v.recordedAt, 64) ||
    !Number.isFinite(Date.parse(v.recordedAt)) ||
    new Date(v.recordedAt).toISOString() !== v.recordedAt ||
    !bounded(p?.id, 160) ||
    !bounded(p?.title, 200) ||
    !bounded(p?.slug, 200) ||
    !bounded(s?.id, 160) ||
    (s?.type !== "user" && s?.type !== "organization") ||
    !Number.isSafeInteger(l?.unitPrice) ||
    !bounded(l?.currency, 16) ||
    b?.commissionBps !== 1000 ||
    b?.holdDays !== 7 ||
    !bounded(b?.licenseModel, 64)
  )
    return null;
  return {
    version: 1,
    recordedAt: v.recordedAt,
    product: { id: p.id, title: p.title, slug: p.slug },
    seller: { type: s.type, id: s.id },
    line: { unitPrice: l.unitPrice as number, currency: l.currency },
    baseline: { commissionBps: 1000, holdDays: 7, licenseModel: b.licenseModel },
  };
}
export type OrderTermsLine = {
  id: string;
  productId: string;
  unitPrice: number;
  currency: string;
  evidence: "recorded" | "legacy" | "unrecognized";
  terms: OrderLineTerms | null;
};
export type OrderTermsReport = {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalAmount: number;
    currency: string;
    createdAt: Date;
  };
  observedAt: Date;
  lines: OrderTermsLine[];
  summary: {
    lines: number;
    legacyLines: number;
    recordedLines: number;
    totals: { currency: string; value: string }[];
    amountMismatch: boolean;
    currencyMismatch: boolean;
    negativeValues: boolean;
    unsupportedCurrency: boolean;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};
export function validatePendingOrder(order: Omit<Order, "createdAt" | "updatedAt">) {
  const fail = () => new AppError("Invalid pending order", 400, "ORDER_TERMS_INVALID");
  const id = (v: string) =>
    typeof v === "string" && /^[A-Za-z0-9_-]{1,160}$/u.test(v) && v.trim() === v;
  if (order.status !== "pending")
    throw new AppError("Provider confirmation is required", 409, "ORDER_CONFIRMATION_REQUIRED");
  if (
    !id(order.id) ||
    !id(order.buyerId) ||
    typeof order.orderNumber !== "string" ||
    order.orderNumber.trim() !== order.orderNumber ||
    order.orderNumber.length < 1 ||
    order.orderNumber.length > 128 ||
    !["USD", "EUR", "RUB"].includes(order.currency) ||
    !Number.isSafeInteger(order.totalAmount) ||
    order.totalAmount < 0 ||
    order.totalAmount > 100_000_000 ||
    !Array.isArray(order.items) ||
    order.items.length < 1 ||
    order.items.length > ORDER_TERMS_LINE_LIMIT
  )
    throw fail();
  const itemIds = new Set<string>(),
    productIds = new Set<string>();
  let total = 0n;
  for (const item of order.items) {
    if (
      !id(item.id) ||
      !id(item.productId) ||
      item.orderId !== order.id ||
      item.currency !== order.currency ||
      !Number.isSafeInteger(item.unitPrice) ||
      item.unitPrice < 0 ||
      item.unitPrice > 100_000_000 ||
      itemIds.has(item.id) ||
      productIds.has(item.productId)
    )
      throw fail();
    itemIds.add(item.id);
    productIds.add(item.productId);
    total += BigInt(item.unitPrice);
  }
  if (total !== BigInt(order.totalAmount)) throw fail();
  return [...order.items].sort((a: OrderItem, b: OrderItem) =>
    a.productId.localeCompare(b.productId, "en"),
  );
}
