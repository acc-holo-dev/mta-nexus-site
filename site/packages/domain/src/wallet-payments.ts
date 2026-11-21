import { BASE_COMMISSION_BPS, commercialFeeEstimate } from "./commercial-plans";
import { AppError } from "./errors";
import type { LedgerPosting } from "./financial-journal";
import { validateLedgerPosting } from "./financial-journal";

/** Wallet engine currencies match the existing ledger allowlist. */
export const WALLET_CURRENCIES = ["USD", "EUR", "RUB"] as const;
export type WalletCurrency = (typeof WALLET_CURRENCIES)[number];

/**
 * Provider ids are stable ports. Live adapters are registered later; `stub` is the
 * only production-shaped adapter that may run without a PSP contract.
 */
export const PAYMENT_PROVIDER_IDS = ["stub", "stripe", "yookassa", "crypto"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDER_IDS)[number];

export const PAYMENT_PROVIDER_CAPABILITIES = [
  "topup",
  "payout",
  "webhook_verify",
  "refund",
] as const;
export type PaymentProviderCapability = (typeof PAYMENT_PROVIDER_CAPABILITIES)[number];

export type TopUpIntentStatus =
  | "created"
  | "awaiting_provider"
  | "succeeded"
  | "failed"
  | "cancelled";

export type TopUpIntent = {
  id: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  providerId: PaymentProviderId;
  status: TopUpIntentStatus;
  idempotencyKey: string;
  providerSessionId: string | null;
  createdAt: string;
};

export type VerifiedProviderEventKind =
  | "topup_succeeded"
  | "topup_failed"
  | "payout_succeeded"
  | "payout_failed";

/**
 * Only a verified provider event may move money. Browser redirects never appear here.
 */
export type VerifiedProviderEvent = {
  providerId: PaymentProviderId;
  providerEventId: string;
  kind: VerifiedProviderEventKind;
  intentId: string;
  amount: number;
  currency: WalletCurrency;
};

export type CreateTopUpSessionInput = {
  intentId: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  idempotencyKey: string;
  returnPath: string;
};

export type CreateTopUpSessionResult = {
  providerSessionId: string;
  /** Hosted checkout URL when the provider redirects; stub may return null. */
  redirectUrl: string | null;
};

export type VerifyWebhookInput = {
  rawBody: string;
  headers: Readonly<Record<string, string>>;
};

export interface PaymentProviderPort {
  readonly id: PaymentProviderId;
  readonly capabilities: readonly PaymentProviderCapability[];
  createTopUpSession(input: CreateTopUpSessionInput): Promise<CreateTopUpSessionResult>;
  /**
   * Authenticate and normalize a provider callback. Implementations must reject
   * unsigned or replayed payloads before returning a VerifiedProviderEvent.
   */
  verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedProviderEvent>;
}

export type ProviderCapabilityRow = {
  id: PaymentProviderId;
  capabilities: readonly PaymentProviderCapability[];
  liveConfigured: boolean;
};

/** Capability matrix used by admin/ops and future checkout UI. */
export function paymentProviderCapabilityMatrix(
  ports: readonly PaymentProviderPort[],
  liveConfigured: Readonly<Partial<Record<PaymentProviderId, boolean>>> = {},
): ProviderCapabilityRow[] {
  return ports.map((port) => ({
    id: port.id,
    capabilities: port.capabilities,
    liveConfigured: liveConfigured[port.id] === true,
  }));
}

export function assertWalletAccountId(accountId: string): void {
  if (!/^(user|org):[A-Za-z0-9_-]{1,128}$/u.test(accountId)) {
    throw new AppError("Wallet account id is invalid", 400, "WALLET_ACCOUNT_INVALID");
  }
}

export function assertWalletAmount(amount: number): void {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 2147483647) {
    throw new AppError(
      "Wallet amount must be a positive minor-unit integer",
      400,
      "WALLET_AMOUNT_INVALID",
    );
  }
}

export function assertWalletCurrency(currency: string): asserts currency is WalletCurrency {
  if (!(WALLET_CURRENCIES as readonly string[]).includes(currency)) {
    throw new AppError("Wallet currency is not supported", 400, "WALLET_CURRENCY_INVALID");
  }
}

export function createTopUpIntent(input: {
  id: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  providerId: PaymentProviderId;
  idempotencyKey: string;
  nowIso: string;
}): TopUpIntent {
  assertWalletAccountId(input.accountId);
  assertWalletAmount(input.amount);
  assertWalletCurrency(input.currency);
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(input.id)) {
    throw new AppError("Top-up intent id is invalid", 400, "TOPUP_INTENT_INVALID");
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(input.idempotencyKey)) {
    throw new AppError("Top-up idempotency key is invalid", 400, "TOPUP_IDEMPOTENCY_INVALID");
  }
  if (!(PAYMENT_PROVIDER_IDS as readonly string[]).includes(input.providerId)) {
    throw new AppError("Payment provider is unknown", 400, "PAYMENT_PROVIDER_UNKNOWN");
  }
  return {
    id: input.id,
    accountId: input.accountId,
    amount: input.amount,
    currency: input.currency,
    providerId: input.providerId,
    status: "created",
    idempotencyKey: input.idempotencyKey,
    providerSessionId: null,
    createdAt: input.nowIso,
  };
}

export function markTopUpAwaitingProvider(
  intent: TopUpIntent,
  providerSessionId: string,
): TopUpIntent {
  if (intent.status !== "created") {
    throw new AppError("Top-up intent cannot start a provider session", 409, "TOPUP_INTENT_STATE");
  }
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(providerSessionId)) {
    throw new AppError("Provider session id is invalid", 400, "PROVIDER_SESSION_INVALID");
  }
  return {
    ...intent,
    status: "awaiting_provider",
    providerSessionId,
  };
}

/**
 * Build the balanced posting that credits the site wallet after a verified top-up.
 * Redirect success alone must never call this.
 */
export function buildVerifiedTopUpCreditPosting(input: {
  intent: TopUpIntent;
  event: VerifiedProviderEvent;
  userEntryId: string;
  clearingEntryId: string;
}): { intent: TopUpIntent; entries: LedgerPosting[] } {
  const { intent, event } = input;
  if (event.kind !== "topup_succeeded") {
    throw new AppError("Provider event is not a successful top-up", 400, "TOPUP_EVENT_KIND");
  }
  if (event.intentId !== intent.id) {
    throw new AppError("Provider event intent mismatch", 400, "TOPUP_EVENT_INTENT_MISMATCH");
  }
  if (event.providerId !== intent.providerId) {
    throw new AppError("Provider event provider mismatch", 400, "TOPUP_EVENT_PROVIDER_MISMATCH");
  }
  if (event.amount !== intent.amount || event.currency !== intent.currency) {
    throw new AppError("Provider event amount or currency mismatch", 400, "TOPUP_EVENT_AMOUNT");
  }
  if (intent.status === "succeeded") {
    throw new AppError("Top-up intent already credited", 409, "TOPUP_ALREADY_CREDITED");
  }
  if (intent.status !== "awaiting_provider" && intent.status !== "created") {
    throw new AppError("Top-up intent cannot be credited", 409, "TOPUP_INTENT_STATE");
  }

  const clearingAccount = `platform:psp_clearing_${intent.providerId}`;
  const entries: LedgerPosting[] = [
    {
      id: input.userEntryId,
      accountId: intent.accountId,
      amount: intent.amount,
      currency: intent.currency,
      referenceType: "topup",
      referenceId: intent.id,
      description: `Verified top-up via ${intent.providerId}`,
    },
    {
      id: input.clearingEntryId,
      accountId: clearingAccount,
      amount: -intent.amount,
      currency: intent.currency,
      referenceType: "topup",
      referenceId: intent.id,
      description: `PSP clearing for top-up ${intent.id}`,
    },
  ];
  validateLedgerPosting(entries);
  return {
    intent: { ...intent, status: "succeeded" },
    entries,
  };
}

export function markTopUpFailed(intent: TopUpIntent, event: VerifiedProviderEvent): TopUpIntent {
  if (event.kind !== "topup_failed" || event.intentId !== intent.id) {
    throw new AppError(
      "Provider event is not a failed top-up for this intent",
      400,
      "TOPUP_EVENT_KIND",
    );
  }
  if (intent.status === "succeeded") {
    throw new AppError("Succeeded top-up cannot fail", 409, "TOPUP_INTENT_STATE");
  }
  return { ...intent, status: "failed" };
}

/**
 * Split a wallet spend gross into platform fee + seller proceeds (ECON-001).
 * Hold/release of seller proceeds remains a later slice; launch credits sellers available.
 */
export function allocateWalletSpendCommission(input: {
  lines: ReadonlyArray<{ grossAmount: number; sellerAccountId: string }>;
  currency: WalletCurrency;
  commissionBps?: number;
}): {
  platformFee: number;
  sellerCredits: Array<{ accountId: string; amount: number }>;
} {
  if (input.lines.length === 0) {
    throw new AppError("Wallet spend requires at least one line", 400, "WALLET_SPEND_INVALID");
  }
  const commissionBps = input.commissionBps ?? BASE_COMMISSION_BPS;
  let platformFee = 0;
  const bySeller = new Map<string, number>();
  for (const line of input.lines) {
    assertWalletAccountId(line.sellerAccountId);
    const quote = commercialFeeEstimate(line.grossAmount, input.currency, commissionBps);
    platformFee += quote.platformFee;
    bySeller.set(
      line.sellerAccountId,
      (bySeller.get(line.sellerAccountId) ?? 0) + quote.sellerProceeds,
    );
  }
  if (!Number.isSafeInteger(platformFee) || platformFee < 0) {
    throw new AppError("Platform fee is out of range", 400, "WALLET_SPEND_INVALID");
  }
  const sellerCredits = [...bySeller.entries()]
    .map(([accountId, amount]) => ({ accountId, amount }))
    .sort((a, b) => a.accountId.localeCompare(b.accountId));
  return { platformFee, sellerCredits };
}

/**
 * Spend available wallet balance against an order with platform fee + seller credits.
 * Caller supplies the current available balance from the ledger projection; this
 * function never invents funds. Seller hold/release is out of scope for this posting.
 */
export function buildWalletSpendPosting(input: {
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  orderId: string;
  availableBalance: number;
  userEntryId: string;
  platformFeeEntryId: string;
  platformFee: number;
  sellerCredits: ReadonlyArray<{ accountId: string; amount: number; entryId: string }>;
}): LedgerPosting[] {
  assertWalletAccountId(input.accountId);
  assertWalletAmount(input.amount);
  assertWalletCurrency(input.currency);
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(input.orderId)) {
    throw new AppError("Order id is invalid", 400, "WALLET_ORDER_INVALID");
  }
  if (!Number.isInteger(input.availableBalance)) {
    throw new AppError("Available balance must be an integer", 400, "WALLET_BALANCE_INVALID");
  }
  if (input.availableBalance < input.amount) {
    throw new AppError("Insufficient wallet balance", 409, "WALLET_INSUFFICIENT_FUNDS");
  }
  if (
    !Number.isSafeInteger(input.platformFee) ||
    input.platformFee < 0 ||
    input.platformFee > input.amount
  ) {
    throw new AppError("Platform fee is out of range", 400, "WALLET_SPEND_INVALID");
  }
  if (input.sellerCredits.length === 0) {
    throw new AppError("Wallet spend requires seller credits", 400, "WALLET_SPEND_INVALID");
  }

  let sellerTotal = 0;
  const seenSellers = new Set<string>();
  const seenEntryIds = new Set<string>([input.userEntryId, input.platformFeeEntryId]);
  for (const credit of input.sellerCredits) {
    assertWalletAccountId(credit.accountId);
    if (credit.accountId === input.accountId) {
      throw new AppError("Buyer cannot be the seller credit target", 400, "WALLET_SPEND_INVALID");
    }
    if (seenSellers.has(credit.accountId) || seenEntryIds.has(credit.entryId)) {
      throw new AppError("Seller credit lines must be unique", 400, "WALLET_SPEND_INVALID");
    }
    if (!Number.isSafeInteger(credit.amount) || credit.amount < 0) {
      throw new AppError("Seller credit is out of range", 400, "WALLET_SPEND_INVALID");
    }
    seenSellers.add(credit.accountId);
    seenEntryIds.add(credit.entryId);
    sellerTotal += credit.amount;
  }
  if (input.platformFee + sellerTotal !== input.amount) {
    throw new AppError("Wallet spend split does not balance", 400, "WALLET_SPEND_INVALID");
  }

  // Journal entries forbid amount === 0; omit zero fee/credit legs after rounding.
  const entries: LedgerPosting[] = [
    {
      id: input.userEntryId,
      accountId: input.accountId,
      amount: -input.amount,
      currency: input.currency,
      referenceType: "wallet_spend",
      referenceId: input.orderId,
      description: `Wallet spend for order ${input.orderId}`,
    },
  ];
  if (input.platformFee > 0) {
    entries.push({
      id: input.platformFeeEntryId,
      accountId: "platform:marketplace",
      amount: input.platformFee,
      currency: input.currency,
      referenceType: "wallet_spend",
      referenceId: input.orderId,
      description: `Platform fee for order ${input.orderId}`,
    });
  }
  for (const credit of input.sellerCredits) {
    if (credit.amount === 0) continue;
    entries.push({
      id: credit.entryId,
      accountId: credit.accountId,
      amount: credit.amount,
      currency: input.currency,
      referenceType: "wallet_spend",
      referenceId: input.orderId,
      description: `Seller proceeds for order ${input.orderId}`,
    });
  }
  validateLedgerPosting(entries);
  return entries;
}

/**
 * Stub provider: production-shaped port with no external network. Useful for
 * local/CI and as the only top-up adapter until real PSP contracts exist.
 */
export class StubPaymentProvider implements PaymentProviderPort {
  readonly id = "stub" as const;
  readonly capabilities = ["topup", "payout", "webhook_verify", "refund"] as const;

  async createTopUpSession(input: CreateTopUpSessionInput): Promise<CreateTopUpSessionResult> {
    assertWalletAccountId(input.accountId);
    assertWalletAmount(input.amount);
    assertWalletCurrency(input.currency);
    return {
      providerSessionId: `stub_sess_${input.intentId}`,
      redirectUrl: null,
    };
  }

  async verifyWebhook(input: VerifyWebhookInput): Promise<VerifiedProviderEvent> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(input.rawBody) as unknown;
    } catch {
      throw new AppError("Stub webhook body is not JSON", 400, "STUB_WEBHOOK_INVALID");
    }
    if (!parsed || typeof parsed !== "object") {
      throw new AppError("Stub webhook body is invalid", 400, "STUB_WEBHOOK_INVALID");
    }
    const body = parsed as Record<string, unknown>;
    const signature =
      input.headers["x-nexus-stub-signature"] ?? input.headers["X-Nexus-Stub-Signature"];
    if (signature !== "stub-ok") {
      throw new AppError("Stub webhook signature rejected", 401, "STUB_WEBHOOK_UNAUTHORIZED");
    }
    const kind = body.kind;
    const intentId = body.intentId;
    const amount = body.amount;
    const currency = body.currency;
    const providerEventId = body.providerEventId;
    if (
      (kind !== "topup_succeeded" &&
        kind !== "topup_failed" &&
        kind !== "payout_succeeded" &&
        kind !== "payout_failed") ||
      typeof intentId !== "string" ||
      typeof providerEventId !== "string" ||
      typeof amount !== "number" ||
      typeof currency !== "string"
    ) {
      throw new AppError("Stub webhook fields are incomplete", 400, "STUB_WEBHOOK_INVALID");
    }
    assertWalletAmount(amount);
    assertWalletCurrency(currency);
    return {
      providerId: "stub",
      providerEventId,
      kind,
      intentId,
      amount,
      currency,
    };
  }
}

export function selectPaymentProvider(
  ports: readonly PaymentProviderPort[],
  providerId: PaymentProviderId,
  capability: PaymentProviderCapability,
): PaymentProviderPort {
  const port = ports.find((candidate) => candidate.id === providerId);
  if (!port) {
    throw new AppError("Payment provider is not registered", 400, "PAYMENT_PROVIDER_UNKNOWN");
  }
  if (!port.capabilities.includes(capability)) {
    throw new AppError("Payment provider lacks capability", 400, "PAYMENT_PROVIDER_CAPABILITY");
  }
  return port;
}
