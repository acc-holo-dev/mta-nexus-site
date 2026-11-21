import {
  buildVerifiedTopUpCreditPosting,
  buildWalletSpendPosting,
  createTopUpIntent,
  markTopUpAwaitingProvider,
  paymentProviderCapabilityMatrix,
  StubPaymentProvider,
  selectPaymentProvider,
  validateLedgerPosting,
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

  it("spends available balance and refuses overdraft", () => {
    const entries = buildWalletSpendPosting({
      accountId: "user:usr_buyer",
      amount: 400,
      currency: "RUB",
      orderId: "ord_spend_1",
      availableBalance: 1500,
      userEntryId: "leg_spend_u",
      marketplaceEntryId: "leg_spend_m",
    });
    expect(() => validateLedgerPosting(entries)).not.toThrow();
    expect(() =>
      buildWalletSpendPosting({
        accountId: "user:usr_buyer",
        amount: 1600,
        currency: "RUB",
        orderId: "ord_spend_2",
        availableBalance: 1500,
        userEntryId: "leg_spend_u2",
        marketplaceEntryId: "leg_spend_m2",
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

  it("starts a stub top-up and credits only after verified webhook", async () => {
    const service = new WalletPaymentService();
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
      started.intent,
    );
    expect(credited.intent.status).toBe("succeeded");
    const entries = credited.entries;
    expect(entries).not.toBeNull();
    if (entries === null) throw new Error("expected ledger entries");
    expect(() => validateLedgerPosting(entries)).not.toThrow();

    const spend = service.spendFromWallet({
      accountId: "user:usr_buyer",
      amount: 100,
      currency: "EUR",
      orderId: "ord_wallet_1",
      availableBalance: 250,
    });
    expect(() => validateLedgerPosting(spend)).not.toThrow();
  });
});
