import {
  allocateWalletSpendCommission,
  buildVerifiedTopUpCreditPosting,
  buildWalletHoldReleasePosting,
  buildWalletSpendPosting,
  createTopUpIntent,
  type LedgerPosting,
  markTopUpAwaitingProvider,
  paymentProviderCapabilityMatrix,
  StubPaymentProvider,
  selectPaymentProvider,
  type TopUpIntent,
  validateLedgerPosting,
  walletHoldReleaseAt,
} from "@nexus/domain";
import { describe, expect, it } from "vitest";
import {
  isWalletEngineEnabled,
  WalletPaymentService,
} from "../../src/lib/services/commerce/wallet-payment-service";

const baseIntent = () =>
  createTopUpIntent({
    id: "wtop_test_intent_1",
    accountId: "user:usr_buyer",
    amount: 1500,
    currency: "RUB",
    providerId: "stub",
    idempotencyKey: "idem_topup_test_1",
    nowIso: "2026-11-21T01:00:00.000Z",
  });

function memoryTopups() {
  const byId = new Map<
    string,
    TopUpIntent & { providerEventId?: string; ledgerBatchId?: string }
  >();
  const byKey = new Map<string, string>();
  return {
    async findById(id: string) {
      return byId.get(id) ?? null;
    },
    async findByIdempotencyKey(key: string) {
      const id = byKey.get(key);
      return id ? (byId.get(id) ?? null) : null;
    },
    async insertAwaiting(input: { intent: TopUpIntent }) {
      byId.set(input.intent.id, input.intent);
      byKey.set(input.intent.idempotencyKey, input.intent.id);
      return input.intent;
    },
    async markSucceeded(input: {
      intentId: string;
      providerEventId: string;
      ledgerBatchId: string;
    }) {
      const current = byId.get(input.intentId);
      if (!current) throw new Error("missing");
      const next = {
        ...current,
        status: "succeeded" as const,
        providerEventId: input.providerEventId,
        ledgerBatchId: input.ledgerBatchId,
      };
      byId.set(input.intentId, next);
      return next;
    },
    async markFailed(intentId: string, providerEventId: string) {
      const current = byId.get(intentId);
      if (!current) throw new Error("missing");
      const next = { ...current, status: "failed" as const, providerEventId };
      byId.set(intentId, next);
      return next;
    },
    async listRecentByAccount(accountId: string, limit = 20) {
      return [...byId.values()]
        .filter((intent) => intent.accountId === accountId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit);
    },
  };
}

function memoryLedger() {
  const batches = new Map<string, LedgerPosting[]>();
  const lines: Array<LedgerPosting & { balanceAfter: number; createdAt: string }> = [];
  return {
    async post(idempotencyKey: string, entries: LedgerPosting[]) {
      validateLedgerPosting(entries);
      const existing = batches.get(idempotencyKey);
      if (existing) return existing;
      batches.set(idempotencyKey, entries);
      for (const entry of entries) {
        lines.push({
          ...entry,
          balanceAfter: entry.amount,
          createdAt: "2026-11-21T02:00:00.000Z",
        });
      }
      return entries;
    },
    async getAccountBalance() {
      return 0;
    },
    async listRecentByAccount(accountId: string, currency: string, limit = 20) {
      return lines
        .filter((entry) => entry.accountId === accountId && entry.currency === currency)
        .slice(-limit)
        .reverse();
    },
  };
}

describe("wallet payments domain", () => {
  it("credits the wallet only from a verified top-up event", () => {
    const awaiting = markTopUpAwaitingProvider(baseIntent(), "stub_sess_wtop_test_intent_1");
    const { intent, entries } = buildVerifiedTopUpCreditPosting({
      intent: awaiting,
      event: {
        providerId: "stub",
        providerEventId: "stub_evt_1",
        kind: "topup_succeeded",
        intentId: awaiting.id,
        amount: 1500,
        currency: "RUB",
      },
      userEntryId: "leg_user_1",
      clearingEntryId: "leg_clear_1",
    });
    expect(intent.status).toBe("succeeded");
    expect(() => validateLedgerPosting(entries)).not.toThrow();
    expect(entries.map((entry) => entry.accountId).sort()).toEqual([
      "platform:psp_clearing_stub",
      "user:usr_buyer",
    ]);
  });

  it("rejects amount mismatches and double credit", () => {
    const awaiting = markTopUpAwaitingProvider(baseIntent(), "stub_sess_wtop_test_intent_1");
    expect(() =>
      buildVerifiedTopUpCreditPosting({
        intent: awaiting,
        event: {
          providerId: "stub",
          providerEventId: "stub_evt_bad",
          kind: "topup_succeeded",
          intentId: awaiting.id,
          amount: 1,
          currency: "RUB",
        },
        userEntryId: "leg_a",
        clearingEntryId: "leg_b",
      }),
    ).toThrow(/amount or currency/i);

    const credited = buildVerifiedTopUpCreditPosting({
      intent: awaiting,
      event: {
        providerId: "stub",
        providerEventId: "stub_evt_2",
        kind: "topup_succeeded",
        intentId: awaiting.id,
        amount: 1500,
        currency: "RUB",
      },
      userEntryId: "leg_c",
      clearingEntryId: "leg_d",
    });
    expect(() =>
      buildVerifiedTopUpCreditPosting({
        intent: credited.intent,
        event: {
          providerId: "stub",
          providerEventId: "stub_evt_3",
          kind: "topup_succeeded",
          intentId: awaiting.id,
          amount: 1500,
          currency: "RUB",
        },
        userEntryId: "leg_e",
        clearingEntryId: "leg_f",
      }),
    ).toThrow(/already credited/i);
  });

  it("releases a matured seller hold from escrow to available", () => {
    const heldAt = "2026-11-01T00:00:00.000Z";
    const releaseAt = walletHoldReleaseAt(heldAt, 7);
    const entries = buildWalletHoldReleasePosting({
      hold: {
        id: "whold_1",
        orderId: "ord_hold_1",
        sellerAccountId: "user:usr_seller",
        escrowAccountId: "escrow:wspend_ord_hold_1_seller",
        amount: 360,
        currency: "EUR",
        status: "held",
        releaseAt,
      },
      escrowEntryId: "ldg_rel_esc",
      sellerEntryId: "ldg_rel_sel",
      nowIso: releaseAt,
    });
    expect(() => validateLedgerPosting(entries)).not.toThrow();
    expect(() =>
      buildWalletHoldReleasePosting({
        hold: {
          id: "whold_1",
          orderId: "ord_hold_1",
          sellerAccountId: "user:usr_seller",
          escrowAccountId: "escrow:wspend_ord_hold_1_seller",
          amount: 360,
          currency: "EUR",
          status: "held",
          releaseAt,
        },
        escrowEntryId: "ldg_rel_esc2",
        sellerEntryId: "ldg_rel_sel2",
        nowIso: heldAt,
      }),
    ).toThrow(/not matured/i);
  });

  it("spends available balance into escrow holds with commission and refuses overdraft", () => {
    const entries = buildWalletSpendPosting({
      accountId: "user:usr_buyer",
      amount: 400,
      currency: "RUB",
      orderId: "ord_spend_1",
      availableBalance: 1500,
      userEntryId: "leg_spend_u",
      platformFeeEntryId: "leg_spend_fee",
      platformFee: 40,
      sellerHolds: [
        {
          sellerAccountId: "user:usr_seller",
          escrowAccountId: "escrow:wspend_ord_spend_1_seller",
          amount: 360,
          entryId: "leg_spend_h",
        },
      ],
    });
    expect(() => validateLedgerPosting(entries)).not.toThrow();
    expect(entries.map((entry) => entry.accountId).sort()).toEqual([
      "escrow:wspend_ord_spend_1_seller",
      "platform:marketplace",
      "user:usr_buyer",
    ]);
    expect(entries.some((entry) => entry.referenceType === "wallet_hold")).toBe(true);
    expect(() =>
      buildWalletSpendPosting({
        accountId: "user:usr_buyer",
        amount: 1600,
        currency: "RUB",
        orderId: "ord_spend_2",
        availableBalance: 1500,
        userEntryId: "leg_spend_u2",
        platformFeeEntryId: "leg_spend_fee2",
        platformFee: 160,
        sellerHolds: [
          {
            sellerAccountId: "user:usr_seller",
            escrowAccountId: "escrow:wspend_ord_spend_2_seller",
            amount: 1440,
            entryId: "leg_spend_h2",
          },
        ],
      }),
    ).toThrow(/Insufficient wallet balance/i);
  });

  it("exposes a multi-provider capability matrix with stub live-ready shape", () => {
    const stub = new StubPaymentProvider();
    const matrix = paymentProviderCapabilityMatrix([stub], { stub: true });
    expect(matrix).toEqual([
      {
        id: "stub",
        capabilities: ["topup", "payout", "webhook_verify", "refund"],
        liveConfigured: true,
      },
    ]);
    expect(selectPaymentProvider([stub], "stub", "topup").id).toBe("stub");
  });

  it("stub provider rejects unsigned webhooks and accepts signed top-up success", async () => {
    const stub = new StubPaymentProvider();
    await expect(
      stub.verifyWebhook({
        rawBody: JSON.stringify({
          kind: "topup_succeeded",
          intentId: "wtop_x",
          amount: 10,
          currency: "USD",
          providerEventId: "e1",
        }),
        headers: {},
      }),
    ).rejects.toThrow(/signature/i);

    await expect(
      stub.verifyWebhook({
        rawBody: JSON.stringify({
          kind: "topup_succeeded",
          intentId: "wtop_x",
          amount: 10,
          currency: "USD",
          providerEventId: "e1",
        }),
        headers: { "x-nexus-stub-signature": "stub-ok" },
      }),
    ).resolves.toMatchObject({
      providerId: "stub",
      kind: "topup_succeeded",
      intentId: "wtop_x",
      amount: 10,
      currency: "USD",
    });
  });
});

describe("wallet payment service", () => {
  it("keeps the engine off unless NEXUS_WALLET_ENGINE=1", () => {
    expect(isWalletEngineEnabled({})).toBe(false);
    expect(isWalletEngineEnabled({ NEXUS_WALLET_ENGINE: "1" })).toBe(true);
  });

  it("persists stub top-up and credits only after verified webhook", async () => {
    const service = new WalletPaymentService(
      [new StubPaymentProvider()],
      memoryTopups() as never,
      memoryLedger() as never,
    );
    const started = await service.startTopUp({
      accountId: "user:usr_buyer",
      amount: 250,
      currency: "EUR",
      providerId: "stub",
      idempotencyKey: "idem_service_topup_1",
      returnPath: "/workspace/finance",
      nowIso: "2026-11-21T02:00:00.000Z",
    });
    expect(started.intent.status).toBe("awaiting_provider");
    expect(started.redirectUrl).toBeNull();

    const credited = await service.applyVerifiedWebhook(
      "stub",
      JSON.stringify({
        kind: "topup_succeeded",
        intentId: started.intent.id,
        amount: 250,
        currency: "EUR",
        providerEventId: "stub_evt_service_1",
      }),
      { "x-nexus-stub-signature": "stub-ok" },
    );
    expect(credited.intent.status).toBe("succeeded");
    const entries = credited.entries;
    expect(entries).not.toBeNull();
    if (entries === null) throw new Error("expected ledger entries");
    expect(() => validateLedgerPosting(entries)).not.toThrow();

    const split = allocateWalletSpendCommission({
      lines: [{ grossAmount: 100, sellerAccountId: "user:usr_seller" }],
      currency: "EUR",
    });
    expect(split.platformFee + split.sellerCredits.reduce((sum, c) => sum + c.amount, 0)).toBe(100);
    const spend = service.spendFromWallet({
      accountId: "user:usr_buyer",
      amount: 100,
      currency: "EUR",
      orderId: "ord_wallet_1",
      availableBalance: 250,
      platformFee: split.platformFee,
      sellerHolds: split.sellerCredits.map((credit) => ({
        sellerAccountId: credit.accountId,
        escrowAccountId: `escrow:wspend_ord_wallet_1_${credit.accountId.slice(5)}`,
        amount: credit.amount,
      })),
    });
    expect(() => validateLedgerPosting(spend)).not.toThrow();
    expect(spend.some((entry) => entry.referenceType === "wallet_hold")).toBe(true);

    const history = await service.listRecentTopUps("user:usr_buyer");
    expect(history).toHaveLength(1);
    expect(history[0]?.id).toBe(started.intent.id);

    const activity = await service.listRecentActivity("user:usr_buyer", "EUR");
    expect(activity.some((entry) => entry.referenceType === "topup")).toBe(true);
  });
});
