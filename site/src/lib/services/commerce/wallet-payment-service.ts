import {
  buildVerifiedTopUpCreditPosting,
  buildWalletSpendPosting,
  createTopUpIntent,
  markTopUpAwaitingProvider,
  markTopUpFailed,
  type PaymentProviderId,
  type PaymentProviderPort,
  paymentProviderCapabilityMatrix,
  StubPaymentProvider,
  selectPaymentProvider,
  type TopUpIntent,
  type VerifiedProviderEvent,
  type WalletCurrency,
} from "@nexus/domain";
import { generateId } from "@nexus/security";

/**
 * Wallet + multi-provider payment engine.
 *
 * Live PSP adapters are not wired. The stub provider is the only default port.
 * HTTP/UI remain disabled until NEXUS_WALLET_ENGINE=1 and a later route slice.
 * Browser redirects never credit the wallet — only verified provider events do.
 */
export function isWalletEngineEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.NEXUS_WALLET_ENGINE === "1";
}

export function defaultPaymentProviders(): PaymentProviderPort[] {
  return [new StubPaymentProvider()];
}

export class WalletPaymentService {
  constructor(
    private readonly providers: readonly PaymentProviderPort[] = defaultPaymentProviders(),
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
    return {
      intent: markTopUpAwaitingProvider(intent, session.providerSessionId),
      redirectUrl: session.redirectUrl,
    };
  }

  async applyVerifiedWebhook(
    providerId: PaymentProviderId,
    rawBody: string,
    headers: Readonly<Record<string, string>>,
    intent: TopUpIntent,
  ): Promise<{
    intent: TopUpIntent;
    entries: ReturnType<typeof buildVerifiedTopUpCreditPosting>["entries"] | null;
  }> {
    const provider = selectPaymentProvider(this.providers, providerId, "webhook_verify");
    const event: VerifiedProviderEvent = await provider.verifyWebhook({ rawBody, headers });
    if (event.kind === "topup_failed") {
      return { intent: markTopUpFailed(intent, event), entries: null };
    }
    const credited = buildVerifiedTopUpCreditPosting({
      intent,
      event,
      userEntryId: generateId("ldg"),
      clearingEntryId: generateId("ldg"),
    });
    return credited;
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
}

export const walletPaymentService = new WalletPaymentService();
