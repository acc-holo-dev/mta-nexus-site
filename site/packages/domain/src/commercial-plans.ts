export const COMMERCIAL_PLAN_DURATIONS = [7, 30, 90, 365] as const;
export const BASE_COMMISSION_BPS = 1000;
export const INITIAL_HOLD_DAYS = 7;
export const COMMERCIAL_CURRENCIES = ["USD", "EUR", "RUB"] as const;
export type CommercialCurrency = (typeof COMMERCIAL_CURRENCIES)[number];
export type CommercialPlanStatus = "draft" | "published" | "archived";
export type CommercialPlanTerms = {
  titleRu: string;
  titleEn: string;
  descriptionRu: string;
  descriptionEn: string;
  price: number;
  currency: CommercialCurrency;
  durationDays: (typeof COMMERCIAL_PLAN_DURATIONS)[number];
  commissionBps: number;
};
export type CommercialPlan = CommercialPlanTerms & {
  id: string;
  slug: string;
  scope: "user" | "organization";
  status: CommercialPlanStatus;
  revision: number;
  updatedAt: Date;
};
export type CommercialPlanCommand =
  | {
      action: "create";
      slug: string;
      scope: "user" | "organization";
      terms: CommercialPlanTerms;
      reason: string;
    }
  | { action: "save"; expectedRevision: number; terms: CommercialPlanTerms; reason: string }
  | { action: "publish" | "archive" | "restore"; expectedRevision: number; reason: string };

/** Quotes use integer minor units. They neither settle funds nor activate a plan. */
export function commercialFeeEstimate(
  grossAmount: number,
  currency: CommercialCurrency,
  commissionBps = BASE_COMMISSION_BPS,
) {
  if (
    !Number.isSafeInteger(grossAmount) ||
    grossAmount < 0 ||
    grossAmount > 100_000_000 ||
    !Number.isSafeInteger(commissionBps) ||
    commissionBps < 0 ||
    commissionBps > BASE_COMMISSION_BPS ||
    !COMMERCIAL_CURRENCIES.includes(currency)
  )
    throw new RangeError("Invalid fee estimate");
  const platformFee = Number((BigInt(grossAmount) * BigInt(commissionBps) + 5000n) / 10_000n);
  return {
    kind: "estimate" as const,
    grossAmount,
    currency,
    commissionBps,
    platformFee,
    sellerProceeds: grossAmount - platformFee,
    initialHoldDays: INITIAL_HOLD_DAYS,
    paidCheckoutAvailable: false as const,
    subscriptionActivationAvailable: false as const,
  };
}

export function commercialPlanTransition(
  status: CommercialPlanStatus,
  action: "save" | "publish" | "archive" | "restore",
): CommercialPlanStatus | null {
  if (action === "restore") return status === "archived" ? "draft" : null;
  if (action === "archive") return status === "archived" ? null : "archived";
  if (action === "publish") return status === "draft" ? "published" : null;
  return status === "archived" ? null : "draft";
}

export type OrderCancellationCommand = {
  requestId: string;
  expectedUpdatedAt: string;
  reason: string;
};
export type OrderCancellationReceipt = {
  kind: "unpaid_order_cancelled";
  orderId: string;
  requestId: string;
  cancelledAt: Date;
};
