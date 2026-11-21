import {
  ledgerRepository,
  orderRepository,
  organizationRepository,
  productRepository,
  type WalletOrderSettlementResult,
  walletOrderSettlementRepository,
  walletSellerHoldRepository,
  walletTopupRepository,
  walletWithdrawalRepository,
} from "@nexus/db";
import {
  AppError,
  assertSellerAccountId,
  buildVerifiedTopUpCreditPosting,
  buildVerifiedWithdrawalPayoutPosting,
  buildVerifiedWithdrawalRefundPosting,
  buildWalletSpendPosting,
  buildWithdrawalHoldPosting,
  canManageOrganization,
  createTopUpIntent,
  createWithdrawalIntent,
  ForbiddenError,
  markTopUpAwaitingProvider,
  markTopUpFailed,
  markWithdrawalAwaitingProvider,
  ORDER_TERMS_LINE_LIMIT,
  type Order,
  type PaymentProviderId,
  type PaymentProviderPort,
  paymentProviderCapabilityMatrix,
  StubPaymentProvider,
  selectPaymentProvider,
  type TopUpIntent,
  type User,
  type VerifiedProviderEvent,
  type WalletCurrency,
  type WalletSellerHold,
  type WithdrawalIntent,
  walletAccountIdForOrganization,
  walletAccountIdForUser,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

/**
 * Wallet + multi-provider payment engine.
 *
 * Live PSP adapters are not wired. The stub provider is the only default port.
 * HTTP routes under `/api/wallet/*`, pay-with-wallet, and checkout/wallet stay dark
 * unless NEXUS_WALLET_ENGINE=1. Browser redirects never credit the wallet — only
 * verified provider events do. Wallet spend settles pending paid orders atomically.
 */
export function isWalletEngineEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXUS_WALLET_ENGINE === "1";
}

/** Withdrawals require the engine and an explicit withdraw policy flag. */
export function isWalletWithdrawEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isWalletEngineEnabled(env) && env.NEXUS_WALLET_WITHDRAW === "1";
}

function defaultPaymentProviders(): PaymentProviderPort[] {
  return [new StubPaymentProvider()];
}

export class WalletPaymentService {
  constructor(
    private readonly providers: readonly PaymentProviderPort[] = defaultPaymentProviders(),
    private readonly topups = walletTopupRepository,
    private readonly withdrawals = walletWithdrawalRepository,
    private readonly ledger = ledgerRepository,
    private readonly settlements = walletOrderSettlementRepository,
    private readonly orders = orderRepository,
    private readonly products = productRepository,
    private readonly holds = walletSellerHoldRepository,
  ) {}

  capabilityMatrix(liveConfigured: Readonly<Partial<Record<PaymentProviderId, boolean>>> = {}) {
    return paymentProviderCapabilityMatrix(this.providers, liveConfigured);
  }

  async startTopUp(input: {
    accountId: string;
    amount: number;
    currency: WalletCurrency;
    providerId: PaymentProviderId;
    idempotencyKey: string;
    returnPath: string;
    nowIso?: string;
  }): Promise<{ intent: TopUpIntent; redirectUrl: string | null }> {
    const existing = await this.topups.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (
        existing.accountId !== input.accountId ||
        existing.amount !== input.amount ||
        existing.currency !== input.currency ||
        existing.providerId !== input.providerId
      ) {
        throw new AppError(
          "Top-up idempotency key already used",
          409,
          "TOPUP_IDEMPOTENCY_CONFLICT",
        );
      }
      return { intent: existing, redirectUrl: null };
    }

    const provider = selectPaymentProvider(this.providers, input.providerId, "topup");
    const intent = createTopUpIntent({
      id: generateId("pay"),
      accountId: input.accountId,
      amount: input.amount,
      currency: input.currency,
      providerId: input.providerId,
      idempotencyKey: input.idempotencyKey,
      nowIso: input.nowIso ?? new Date().toISOString(),
    });
    const session = await provider.createTopUpSession({
      intentId: intent.id,
      accountId: intent.accountId,
      amount: intent.amount,
      currency: intent.currency,
      idempotencyKey: intent.idempotencyKey,
      returnPath: input.returnPath,
    });
    const awaiting = markTopUpAwaitingProvider(intent, session.providerSessionId);
    const stored = await this.topups.insertAwaiting({
      intent: awaiting,
      returnPath: input.returnPath,
    });
    return {
      intent: stored,
      redirectUrl: session.redirectUrl,
    };
  }

  async startWithdrawal(input: {
    accountId: string;
    amount: number;
    currency: WalletCurrency;
    providerId: PaymentProviderId;
    idempotencyKey: string;
    nowIso?: string;
  }): Promise<{ intent: WithdrawalIntent }> {
    if (!isWalletWithdrawEnabled()) {
      throw new AppError("Wallet withdrawals are disabled", 404, "WALLET_WITHDRAW_DISABLED");
    }
    const existing = await this.withdrawals.findByIdempotencyKey(input.idempotencyKey);
    if (existing) {
      if (
        existing.accountId !== input.accountId ||
        existing.amount !== input.amount ||
        existing.currency !== input.currency ||
        existing.providerId !== input.providerId
      ) {
        throw new AppError(
          "Withdrawal idempotency key already used",
          409,
          "WITHDRAWAL_IDEMPOTENCY_CONFLICT",
        );
      }
      return { intent: existing };
    }

    const provider = selectPaymentProvider(this.providers, input.providerId, "payout");
    const intent = createWithdrawalIntent({
      id: generateId("wwd"),
      accountId: input.accountId,
      amount: input.amount,
      currency: input.currency,
      providerId: input.providerId,
      idempotencyKey: input.idempotencyKey,
      nowIso: input.nowIso ?? new Date().toISOString(),
    });
    const session = await provider.createPayoutSession({
      intentId: intent.id,
      accountId: intent.accountId,
      amount: intent.amount,
      currency: intent.currency,
      idempotencyKey: intent.idempotencyKey,
    });
    const awaiting = markWithdrawalAwaitingProvider(intent, session.providerSessionId);
    const available = await this.ledger.getAccountBalance(awaiting.accountId, awaiting.currency);
    const holdEntries = buildWithdrawalHoldPosting({
      intent: awaiting,
      availableBalance: available,
      userEntryId: generateId("ldg"),
      escrowEntryId: generateId("ldg"),
    });
    const stored = await this.withdrawals.insertHoldAwaiting({
      intent: awaiting,
      holdLedgerBatchId: `wwd_hold_${awaiting.id}`,
      holdEntries,
    });
    return { intent: stored };
  }

  async listRecentWithdrawals(accountId: string, limit = 20): Promise<WithdrawalIntent[]> {
    return this.withdrawals.listRecentByAccount(accountId, limit);
  }

  async applyVerifiedWebhook(
    providerId: PaymentProviderId,
    rawBody: string,
    headers: Readonly<Record<string, string>>,
    intentId?: string,
  ): Promise<{
    intent: TopUpIntent | WithdrawalIntent;
    entries: ReturnType<typeof buildVerifiedTopUpCreditPosting>["entries"] | null;
    kind: VerifiedProviderEvent["kind"];
  }> {
    const provider = selectPaymentProvider(this.providers, providerId, "webhook_verify");
    const event: VerifiedProviderEvent = await provider.verifyWebhook({ rawBody, headers });
    const targetId = intentId ?? event.intentId;

    if (event.kind === "payout_succeeded" || event.kind === "payout_failed") {
      return this.applyVerifiedPayoutEvent(event, targetId);
    }

    const stored = await this.topups.findById(targetId);
    if (!stored) {
      throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
    }

    if (event.kind === "topup_failed") {
      const failedDomain = markTopUpFailed(stored, event);
      const failed = await this.topups.markFailed(failedDomain.id, event.providerEventId);
      return { intent: failed, entries: null, kind: event.kind };
    }

    if (stored.status === "succeeded") {
      return { intent: stored, entries: null, kind: event.kind };
    }

    const credited = buildVerifiedTopUpCreditPosting({
      intent: stored,
      event,
      userEntryId: generateId("ldg"),
      clearingEntryId: generateId("ldg"),
    });
    const batchId = `topup_${stored.id}`;
    if (
      "creditVerified" in this.topups &&
      typeof (this.topups as { creditVerified?: unknown }).creditVerified === "function"
    ) {
      const result = await (
        this.topups as {
          creditVerified: (input: {
            intentId: string;
            providerEventId: string;
            ledgerBatchId: string;
            entries: typeof credited.entries;
          }) => Promise<{ intent: TopUpIntent; entries: typeof credited.entries | null }>;
        }
      ).creditVerified({
        intentId: stored.id,
        providerEventId: event.providerEventId,
        ledgerBatchId: batchId,
        entries: credited.entries,
      });
      return {
        intent: result.intent,
        entries: result.entries ?? credited.entries,
        kind: event.kind,
      };
    }
    await this.ledger.post(batchId, credited.entries);
    const intent = await this.topups.markSucceeded({
      intentId: stored.id,
      providerEventId: event.providerEventId,
      ledgerBatchId: batchId,
    });
    return { intent, entries: credited.entries, kind: event.kind };
  }

  private async applyVerifiedPayoutEvent(
    event: VerifiedProviderEvent,
    targetId: string,
  ): Promise<{
    intent: WithdrawalIntent;
    entries: ReturnType<typeof buildVerifiedWithdrawalPayoutPosting> | null;
    kind: VerifiedProviderEvent["kind"];
  }> {
    const stored = await this.withdrawals.findById(targetId);
    if (!stored) {
      throw new AppError("Withdrawal intent not found", 404, "WITHDRAWAL_NOT_FOUND");
    }
    if (event.kind === "payout_failed") {
      const entries = buildVerifiedWithdrawalRefundPosting({
        intent: stored,
        event,
        escrowEntryId: generateId("ldg"),
        userEntryId: generateId("ldg"),
      });
      const result = await this.withdrawals.failVerified({
        intentId: stored.id,
        providerEventId: event.providerEventId,
        settleLedgerBatchId: `wwd_fail_${stored.id}`,
        entries,
      });
      return { intent: result.intent, entries: result.entries ?? entries, kind: event.kind };
    }
    if (stored.status === "succeeded") {
      return { intent: stored, entries: null, kind: event.kind };
    }
    const entries = buildVerifiedWithdrawalPayoutPosting({
      intent: stored,
      event,
      escrowEntryId: generateId("ldg"),
      clearingEntryId: generateId("ldg"),
    });
    const result = await this.withdrawals.settleVerified({
      intentId: stored.id,
      providerEventId: event.providerEventId,
      settleLedgerBatchId: `wwd_pay_${stored.id}`,
      entries,
    });
    return { intent: result.intent, entries: result.entries ?? entries, kind: event.kind };
  }

  spendFromWallet(input: {
    accountId: string;
    amount: number;
    currency: WalletCurrency;
    orderId: string;
    availableBalance: number;
    platformFee: number;
    sellerHolds: ReadonlyArray<{
      sellerAccountId: string;
      escrowAccountId: string;
      amount: number;
    }>;
  }) {
    return buildWalletSpendPosting({
      accountId: input.accountId,
      amount: input.amount,
      currency: input.currency,
      orderId: input.orderId,
      availableBalance: input.availableBalance,
      userEntryId: generateId("ldg"),
      platformFeeEntryId: generateId("ldg"),
      platformFee: input.platformFee,
      sellerHolds: input.sellerHolds.map((hold) => ({
        ...hold,
        entryId: generateId("ldg"),
      })),
    });
  }

  async settleOrderFromWallet(input: { user: User; currentToken: string; orderId: string }) {
    return this.settlements.settle({
      buyerId: input.user.id,
      currentToken: input.currentToken,
      orderId: input.orderId,
    });
  }

  async createPendingPaidOrder(input: {
    user: User;
    order: Omit<Order, "createdAt" | "updatedAt">;
  }): Promise<Order> {
    if (input.order.buyerId !== input.user.id) {
      throw new AppError("Buyer mismatch", 403, "FORBIDDEN");
    }
    if (input.order.totalAmount <= 0) {
      throw new AppError("Paid order requires a positive total", 400, "ORDER_NOT_PAYABLE");
    }
    return this.orders.create(input.order);
  }

  /**
   * Create a pending paid order from published paid catalog lines and settle it
   * from the buyer's site wallet. Card `/api/checkout` stays disabled.
   */
  async checkoutAndSettleFromWallet(input: {
    user: User;
    currentToken: string;
    productIds: string[];
  }): Promise<WalletOrderSettlementResult & { orderNumber: string }> {
    const uniqueIds = [...new Set(input.productIds)];
    if (
      uniqueIds.length === 0 ||
      uniqueIds.length > ORDER_TERMS_LINE_LIMIT ||
      uniqueIds.length !== input.productIds.length
    ) {
      throw new AppError("Invalid wallet checkout", 400, "WALLET_CHECKOUT_INVALID");
    }

    const catalog = await this.products.listPublishedPaidByIds(uniqueIds);
    if (catalog.length !== uniqueIds.length) {
      throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
    }
    const byId = new Map(catalog.map((product) => [product.id, product]));
    const ordered = uniqueIds.map((id) => {
      const product = byId.get(id);
      if (!product) throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
      return product;
    });

    const first = ordered[0];
    if (!first) throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
    const currency = first.currency as WalletCurrency;
    if (!["USD", "EUR", "RUB"].includes(currency)) {
      throw new AppError("Order currency is not supported", 400, "WALLET_CURRENCY_INVALID");
    }
    if (ordered.some((product) => product.currency !== currency)) {
      throw new AppError("Mixed currencies are not supported", 400, "WALLET_CHECKOUT_INVALID");
    }

    let total = 0n;
    for (const product of ordered) {
      if (!Number.isSafeInteger(product.price) || product.price <= 0) {
        throw new AppError("Catalog terms changed", 409, "ORDER_CATALOG_CHANGED");
      }
      total += BigInt(product.price);
    }
    if (total <= 0n || total > 100_000_000n) {
      throw new AppError("Order total is out of range", 400, "ORDER_NOT_PAYABLE");
    }

    const orderId = generateId("ord");
    const orderNumber = `NEXUS-${orderId.slice(4, 12).toUpperCase()}`;
    const order: Omit<Order, "createdAt" | "updatedAt"> = {
      id: orderId,
      orderNumber,
      buyerId: input.user.id,
      status: "pending",
      totalAmount: Number(total),
      currency,
      items: ordered.map((product) => ({
        id: generateId("ite"),
        orderId,
        productId: product.id,
        unitPrice: product.price,
        currency,
      })),
    };

    await this.createPendingPaidOrder({ user: input.user, order });
    const settled = await this.settleOrderFromWallet({
      user: input.user,
      currentToken: input.currentToken,
      orderId,
    });
    return { ...settled, orderNumber };
  }

  async getAvailableBalance(accountId: string, currency: WalletCurrency): Promise<number> {
    return this.ledger.getAccountBalance(accountId, currency);
  }

  async listRecentTopUps(accountId: string, limit = 20): Promise<TopUpIntent[]> {
    return this.topups.listRecentByAccount(accountId, limit);
  }

  /** Audited ledger lines for the account (top-up credits and wallet spends). */
  async listRecentActivity(accountId: string, currency: WalletCurrency, limit = 20) {
    return this.ledger.listRecentByAccount(accountId, currency, limit);
  }

  /**
   * Resolve the seller ledger account the actor may inspect or release.
   * Personal account by default; organization account when the actor is owner/admin.
   */
  async resolveSellerAccountId(actor: User, organizationId?: string): Promise<string> {
    if (!organizationId) {
      const accountId = walletAccountIdForUser(actor.id);
      assertSellerAccountId(accountId);
      return accountId;
    }
    const membership = await organizationRepository.findServerMembershipForUser(
      organizationId,
      actor.id,
    );
    if (!membership || !canManageOrganization(membership.role)) {
      throw new ForbiddenError("Not authorized for organization seller holds");
    }
    const accountId = walletAccountIdForOrganization(organizationId);
    assertSellerAccountId(accountId);
    return accountId;
  }

  async listManageableOrganizationSellerAccounts(
    actor: User,
  ): Promise<Array<{ organizationId: string; accountId: string }>> {
    const memberships = await organizationRepository.listUserMemberships(actor.id);
    return memberships
      .filter((membership) => canManageOrganization(membership.role))
      .map((membership) => ({
        organizationId: membership.organizationId,
        accountId: walletAccountIdForOrganization(membership.organizationId),
      }));
  }

  async getHeldBalance(sellerAccountId: string, currency: WalletCurrency): Promise<number> {
    assertSellerAccountId(sellerAccountId);
    return this.holds.sumHeldBySeller(sellerAccountId, currency);
  }

  async listHeld(sellerAccountId: string, limit = 20): Promise<WalletSellerHold[]> {
    assertSellerAccountId(sellerAccountId);
    return this.holds.listHeldBySeller(sellerAccountId, limit);
  }

  async releaseMaturedHolds(sellerAccountId: string, nowIso?: string): Promise<WalletSellerHold[]> {
    assertSellerAccountId(sellerAccountId);
    return this.holds.releaseMaturedForSeller({ sellerAccountId, nowIso });
  }

  /** Operator/admin batch: release matured holds across all seller accounts. */
  async releaseMaturedHoldsBatch(input: {
    nowIso?: string;
    limit?: number;
  }): Promise<WalletSellerHold[]> {
    return this.holds.releaseMaturedBatch(input);
  }
}
