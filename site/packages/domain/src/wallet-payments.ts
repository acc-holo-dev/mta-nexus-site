import { BASE_COMMISSION_BPS, commercialFeeEstimate, INITIAL_HOLD_DAYS } from "./commercial-plans";
import { AppError } from "./errors";
import type { LedgerPosting } from "./financial-journal";
import { validateLedgerPosting } from "./financial-journal";

export { INITIAL_HOLD_DAYS };

export type WalletSellerHoldStatus = "held" | "released" | "cancelled";

export type WalletSellerHold = {
  id: string;
  orderId: string;
  sellerAccountId: string;
  escrowAccountId: string;
  amount: number;
  currency: WalletCurrency;
  status: WalletSellerHoldStatus;
  heldAt: string;
  releaseAt: string;
  holdLedgerBatchId: string;
  releaseLedgerBatchId: string | null;
};

export function assertEscrowAccountId(accountId: string): void {
  if (!/^escrow:[A-Za-z0-9_-]{1,160}$/u.test(accountId)) {
    throw new AppError("Escrow account id is invalid", 400, "WALLET_ACCOUNT_INVALID");
  }
}

/** Personal or organization seller ledger accounts used for ECON-002 holds. */
export function assertSellerAccountId(accountId: string): void {
  if (!/^(?:user|org):[A-Za-z0-9_-]{1,160}$/u.test(accountId)) {
    throw new AppError("Seller account id is invalid", 400, "WALLET_ACCOUNT_INVALID");
  }
}

export function walletAccountIdForUser(userId: string): string {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(userId)) {
    throw new AppError("User id is invalid", 400, "WALLET_ACCOUNT_INVALID");
  }
  return `user:${userId}`;
}

export function walletAccountIdForOrganization(organizationId: string): string {
  if (!/^[A-Za-z0-9_-]{3,128}$/u.test(organizationId)) {
    throw new AppError("Organization id is invalid", 400, "WALLET_ACCOUNT_INVALID");
  }
  return `org:${organizationId}`;
}

export function walletHoldReleaseAt(heldAtIso: string, holdDays = INITIAL_HOLD_DAYS): string {
  if (!Number.isSafeInteger(holdDays) || holdDays < 1 || holdDays > 365) {
    throw new AppError("Hold days are out of range", 400, "WALLET_HOLD_INVALID");
  }
  const heldAt = Date.parse(heldAtIso);
  if (!Number.isFinite(heldAt)) {
    throw new AppError("Hold timestamp is invalid", 400, "WALLET_HOLD_INVALID");
  }
  return new Date(heldAt + holdDays * 86_400_000).toISOString();
}

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

/** Withdrawal intents debit available balance into escrow until a verified payout event. */
export type WithdrawalIntentStatus =
  | "created"
  | "awaiting_provider"
  | "succeeded"
  | "failed"
  | "cancelled";

export type WithdrawalIntent = {
  id: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  providerId: PaymentProviderId;
  status: WithdrawalIntentStatus;
  idempotencyKey: string;
  providerSessionId: string | null;
  escrowAccountId: string;
  createdAt: string;
};

export function withdrawalEscrowAccountId(intentId: string): string {
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(intentId)) {
    throw new AppError("Withdrawal intent id is invalid", 400, "WITHDRAWAL_INTENT_INVALID");
  }
  return `escrow:wwithdraw_${intentId}`;
}

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

export type CreatePayoutSessionInput = {
  intentId: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  idempotencyKey: string;
};

export type CreatePayoutSessionResult = {
  providerSessionId: string;
};

export type VerifyWebhookInput = {
  rawBody: string;
  headers: Readonly<Record<string, string>>;
};

export interface PaymentProviderPort {
  readonly id: PaymentProviderId;
  readonly capabilities: readonly PaymentProviderCapability[];
  createTopUpSession(input: CreateTopUpSessionInput): Promise<CreateTopUpSessionResult>;
  createPayoutSession(input: CreatePayoutSessionInput): Promise<CreatePayoutSessionResult>;
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

export function createWithdrawalIntent(input: {
  id: string;
  accountId: string;
  amount: number;
  currency: WalletCurrency;
  providerId: PaymentProviderId;
  idempotencyKey: string;
  nowIso: string;
}): WithdrawalIntent {
  assertWalletAccountId(input.accountId);
  assertWalletAmount(input.amount);
  assertWalletCurrency(input.currency);
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(input.id)) {
    throw new AppError("Withdrawal intent id is invalid", 400, "WITHDRAWAL_INTENT_INVALID");
  }
  if (!/^[A-Za-z0-9_-]{8,128}$/u.test(input.idempotencyKey)) {
    throw new AppError(
      "Withdrawal idempotency key is invalid",
      400,
      "WITHDRAWAL_IDEMPOTENCY_INVALID",
    );
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
    escrowAccountId: withdrawalEscrowAccountId(input.id),
    createdAt: input.nowIso,
  };
}

export function markWithdrawalAwaitingProvider(
  intent: WithdrawalIntent,
  providerSessionId: string,
): WithdrawalIntent {
  if (intent.status !== "created") {
    throw new AppError(
      "Withdrawal intent cannot start a provider session",
      409,
      "WITHDRAWAL_INTENT_STATE",
    );
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

/** Hold available balance in withdrawal escrow until a verified payout event. */
export function buildWithdrawalHoldPosting(input: {
  intent: WithdrawalIntent;
  availableBalance: number;
  userEntryId: string;
  escrowEntryId: string;
}): LedgerPosting[] {
  const { intent } = input;
  assertWalletAccountId(intent.accountId);
  assertEscrowAccountId(intent.escrowAccountId);
  assertWalletAmount(intent.amount);
  assertWalletCurrency(intent.currency);
  if (input.availableBalance < intent.amount) {
    throw new AppError(
      "Available wallet balance is insufficient",
      409,
      "WALLET_INSUFFICIENT_FUNDS",
    );
  }
  if (intent.status !== "awaiting_provider") {
    throw new AppError("Withdrawal intent is not ready to hold", 409, "WITHDRAWAL_INTENT_STATE");
  }
  const entries: LedgerPosting[] = [
    {
      id: input.userEntryId,
      accountId: intent.accountId,
      amount: -intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `Withdrawal hold via ${intent.providerId}`,
    },
    {
      id: input.escrowEntryId,
      accountId: intent.escrowAccountId,
      amount: intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `Escrow for withdrawal ${intent.id}`,
    },
  ];
  validateLedgerPosting(entries);
  return entries;
}

/** Move held withdrawal funds to PSP payout clearing after verified success. */
export function buildVerifiedWithdrawalPayoutPosting(input: {
  intent: WithdrawalIntent;
  event: VerifiedProviderEvent;
  escrowEntryId: string;
  clearingEntryId: string;
}): LedgerPosting[] {
  const { intent, event } = input;
  if (event.kind !== "payout_succeeded") {
    throw new AppError("Provider event is not a successful payout", 400, "PAYOUT_EVENT_KIND");
  }
  if (event.intentId !== intent.id) {
    throw new AppError("Provider event intent mismatch", 400, "PAYOUT_EVENT_INTENT_MISMATCH");
  }
  if (event.providerId !== intent.providerId) {
    throw new AppError("Provider event provider mismatch", 400, "PAYOUT_EVENT_PROVIDER_MISMATCH");
  }
  if (event.amount !== intent.amount || event.currency !== intent.currency) {
    throw new AppError("Provider event amount or currency mismatch", 400, "PAYOUT_EVENT_AMOUNT");
  }
  if (intent.status === "succeeded") {
    throw new AppError("Withdrawal already paid out", 409, "WITHDRAWAL_ALREADY_PAID");
  }
  if (intent.status !== "awaiting_provider") {
    throw new AppError("Withdrawal intent cannot be paid out", 409, "WITHDRAWAL_INTENT_STATE");
  }
  assertEscrowAccountId(intent.escrowAccountId);
  const clearingAccount = `platform:psp_payout_clearing_${intent.providerId}`;
  const entries: LedgerPosting[] = [
    {
      id: input.escrowEntryId,
      accountId: intent.escrowAccountId,
      amount: -intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `Payout settle for withdrawal ${intent.id}`,
    },
    {
      id: input.clearingEntryId,
      accountId: clearingAccount,
      amount: intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `PSP payout clearing for ${intent.id}`,
    },
  ];
  validateLedgerPosting(entries);
  return entries;
}

/** Return held withdrawal funds to available balance after verified payout failure. */
export function buildVerifiedWithdrawalRefundPosting(input: {
  intent: WithdrawalIntent;
  event: VerifiedProviderEvent;
  escrowEntryId: string;
  userEntryId: string;
}): LedgerPosting[] {
  const { intent, event } = input;
  if (event.kind !== "payout_failed") {
    throw new AppError("Provider event is not a failed payout", 400, "PAYOUT_EVENT_KIND");
  }
  if (event.intentId !== intent.id) {
    throw new AppError("Provider event intent mismatch", 400, "PAYOUT_EVENT_INTENT_MISMATCH");
  }
  if (intent.status === "succeeded") {
    throw new AppError("Succeeded withdrawal cannot fail", 409, "WITHDRAWAL_INTENT_STATE");
  }
  if (intent.status !== "awaiting_provider") {
    throw new AppError("Withdrawal intent cannot fail", 409, "WITHDRAWAL_INTENT_STATE");
  }
  assertWalletAccountId(intent.accountId);
  assertEscrowAccountId(intent.escrowAccountId);
  const entries: LedgerPosting[] = [
    {
      id: input.escrowEntryId,
      accountId: intent.escrowAccountId,
      amount: -intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `Release failed withdrawal escrow ${intent.id}`,
    },
    {
      id: input.userEntryId,
      accountId: intent.accountId,
      amount: intent.amount,
      currency: intent.currency,
      referenceType: "withdrawal",
      referenceId: intent.id,
      description: `Return failed withdrawal ${intent.id}`,
    },
  ];
  validateLedgerPosting(entries);
  return entries;
}

/**
 * Split a wallet spend gross into platform fee + seller proceeds (ECON-001).
 * Seller proceeds are held in escrow for INITIAL_HOLD_DAYS (ECON-002) before release.
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
 * Spend available wallet balance against an order: buyer debit, platform fee,
 * seller proceeds into escrow (wallet_hold). Release is a separate posting.
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
  sellerHolds: ReadonlyArray<{
    sellerAccountId: string;
    escrowAccountId: string;
    amount: number;
    entryId: string;
  }>;
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
  if (input.sellerHolds.length === 0) {
    throw new AppError("Wallet spend requires seller holds", 400, "WALLET_SPEND_INVALID");
  }

  let sellerTotal = 0;
  const seenSellers = new Set<string>();
  const seenEscrows = new Set<string>();
  const seenEntryIds = new Set<string>([input.userEntryId, input.platformFeeEntryId]);
  for (const hold of input.sellerHolds) {
    assertWalletAccountId(hold.sellerAccountId);
    assertEscrowAccountId(hold.escrowAccountId);
    if (hold.sellerAccountId === input.accountId) {
      throw new AppError("Buyer cannot be the seller credit target", 400, "WALLET_SPEND_INVALID");
    }
    if (
      seenSellers.has(hold.sellerAccountId) ||
      seenEscrows.has(hold.escrowAccountId) ||
      seenEntryIds.has(hold.entryId)
    ) {
      throw new AppError("Seller hold lines must be unique", 400, "WALLET_SPEND_INVALID");
    }
    if (!Number.isSafeInteger(hold.amount) || hold.amount < 0) {
      throw new AppError("Seller hold is out of range", 400, "WALLET_SPEND_INVALID");
    }
    seenSellers.add(hold.sellerAccountId);
    seenEscrows.add(hold.escrowAccountId);
    seenEntryIds.add(hold.entryId);
    sellerTotal += hold.amount;
  }
  if (input.platformFee + sellerTotal !== input.amount) {
    throw new AppError("Wallet spend split does not balance", 400, "WALLET_SPEND_INVALID");
  }

  // Journal entries forbid amount === 0; omit zero fee/hold legs after rounding.
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
  for (const hold of input.sellerHolds) {
    if (hold.amount === 0) continue;
    entries.push({
      id: hold.entryId,
      accountId: hold.escrowAccountId,
      amount: hold.amount,
      currency: input.currency,
      referenceType: "wallet_hold",
      referenceId: input.orderId,
      description: `Seller hold for order ${input.orderId} (${hold.sellerAccountId})`,
    });
  }
  validateLedgerPosting(entries);
  return entries;
}

/** Release a matured seller hold from escrow into the seller available balance. */
export function buildWalletHoldReleasePosting(input: {
  hold: Pick<
    WalletSellerHold,
    | "id"
    | "orderId"
    | "sellerAccountId"
    | "escrowAccountId"
    | "amount"
    | "currency"
    | "status"
    | "releaseAt"
  >;
  escrowEntryId: string;
  sellerEntryId: string;
  nowIso: string;
}): LedgerPosting[] {
  if (input.hold.status !== "held") {
    throw new AppError("Hold is not releasable", 409, "WALLET_HOLD_STATE");
  }
  const nowMs = Date.parse(input.nowIso);
  const releaseMs = Date.parse(input.hold.releaseAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(releaseMs) || nowMs < releaseMs) {
    throw new AppError("Hold is not matured", 409, "WALLET_HOLD_NOT_MATURE");
  }
  assertWalletAccountId(input.hold.sellerAccountId);
  assertEscrowAccountId(input.hold.escrowAccountId);
  assertWalletAmount(input.hold.amount);
  assertWalletCurrency(input.hold.currency);
  const entries: LedgerPosting[] = [
    {
      id: input.escrowEntryId,
      accountId: input.hold.escrowAccountId,
      amount: -input.hold.amount,
      currency: input.hold.currency,
      referenceType: "wallet_hold",
      referenceId: input.hold.orderId,
      description: `Release seller hold ${input.hold.id}`,
    },
    {
      id: input.sellerEntryId,
      accountId: input.hold.sellerAccountId,
      amount: input.hold.amount,
      currency: input.hold.currency,
      referenceType: "wallet_hold",
      referenceId: input.hold.orderId,
      description: `Seller proceeds available from hold ${input.hold.id}`,
    },
  ];
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

  async createPayoutSession(input: CreatePayoutSessionInput): Promise<CreatePayoutSessionResult> {
    assertWalletAccountId(input.accountId);
    assertWalletAmount(input.amount);
    assertWalletCurrency(input.currency);
    return {
      providerSessionId: `stub_payout_${input.intentId}`,
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
