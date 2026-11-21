import {
  ledgerRepository,
  orderRepository,
  walletOrderSettlementRepository,
  walletTopupRepository,
} from "@nexus/db";
import {
  AppError,
  buildVerifiedTopUpCreditPosting,
  buildWalletSpendPosting,
  createTopUpIntent,
  markTopUpAwaitingProvider,
  markTopUpFailed,
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
} from "@nexus/domain";
import { generateId } from "@nexus/security";

/**
 * Wallet + multi-provider payment engine.
 *
 * Live PSP adapters are not wired. The stub provider is the only default port.
 * HTTP routes under `/api/wallet/*` and pay-with-wallet stay dark unless
 * NEXUS_WALLET_ENGINE=1. Browser redirects never credit the wallet — only verified
 * provider events do. Wallet spend settles pending paid orders atomically.
 */
export function isWalletEngineEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXUS_WALLET_ENGINE === "1";
}

function defaultPaymentProviders(): PaymentProviderPort[] {
  return [new StubPaymentProvider()];
}

export class WalletPaymentService {
  constructor(
    private readonly providers: readonly PaymentProviderPort[] = defaultPaymentProviders(),
    private readonly topups = walletTopupRepository,
    private readonly ledger = ledgerRepository,
    private readonly settlements = walletOrderSettlementRepository,
    private readonly orders = orderRepository,
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

  async applyVerifiedWebhook(
    providerId: PaymentProviderId,
    rawBody: string,
    headers: Readonly<Record<string, string>>,
    intentId?: string,
  ): Promise<{
    intent: TopUpIntent;
    entries: ReturnType<typeof buildVerifiedTopUpCreditPosting>["entries"] | null;
  }> {
    const provider = selectPaymentProvider(this.providers, providerId, "webhook_verify");
    const event: VerifiedProviderEvent = await provider.verifyWebhook({ rawBody, headers });
    const targetId = intentId ?? event.intentId;
    const stored = await this.topups.findById(targetId);
    if (!stored) {
      throw new AppError("Top-up intent not found", 404, "TOPUP_NOT_FOUND");
    }

    if (event.kind === "topup_failed") {
      const failedDomain = markTopUpFailed(stored, event);
      const failed = await this.topups.markFailed(failedDomain.id, event.providerEventId);
      return { intent: failed, entries: null };
    }

    if (stored.status === "succeeded") {
      return { intent: stored, entries: null };
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
      return { intent: result.intent, entries: result.entries ?? credited.entries };
    }
    await this.ledger.post(batchId, credited.entries);
    const intent = await this.topups.markSucceeded({
      intentId: stored.id,
      providerEventId: event.providerEventId,
      ledgerBatchId: batchId,
    });
    return { intent, entries: credited.entries };
  }

  spendFromWallet(input: {
    accountId: string;
    amount: number;
    currency: WalletCurrency;
    orderId: string;
    availableBalance: number;
  }) {
    return buildWalletSpendPosting({
      ...input,
      userEntryId: generateId("ldg"),
      marketplaceEntryId: generateId("ldg"),
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

  async getAvailableBalance(accountId: string, currency: WalletCurrency): Promise<number> {
    return this.ledger.getAccountBalance(accountId, currency);
  }

  async listRecentTopUps(accountId: string, limit = 20): Promise<TopUpIntent[]> {
    return this.topups.listRecentByAccount(accountId, limit);
  }
}
