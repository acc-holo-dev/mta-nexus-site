import {
  createWithdrawalIntent,
  type LedgerPosting,
  markWithdrawalAwaitingProvider,
  StubPaymentProvider,
  type TopUpIntent,
  type WithdrawalIntent,
} from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@nexus/db", () => ({
  accountEmailEnrollmentRepository: {},
  accountPasswordResetRepository: {},
  accountRecoveryAbuseLimitRepository: {},
  authRepository: {},
  buildRepository: {},
  getPinnedAccountMailProducerCipher: () => "cipher",
  getPinnedAccountRecoveryAbuseKey: () => "abuse-key",
  ledgerRepository: {},
  orderOperationsRepository: {},
  orderRepository: {},
  organizationRepository: {},
  productRepository: {},
  promoCodeRepository: {},
  sessionRepository: {},
  userRepository: {},
  walletFxRateRepository: {},
  walletOrderSettlementRepository: {},
  walletSellerHoldRepository: {},
  walletTopupRepository: {},
  walletWithdrawalRepository: {},
}));

import { POST as webhook } from "../../src/app/api/wallet/providers/[providerId]/webhook/route";
import { WalletPaymentService } from "../../src/lib/services/commerce/wallet-payment-service";

const signatureHeaders = { "x-nexus-stub-signature": "stub-ok" };

function webhookBody(
  kind: "topup_succeeded" | "payout_succeeded",
  intentId: string,
  amount: number,
  currency: "EUR",
) {
  return JSON.stringify({
    kind,
    intentId,
    amount,
    currency,
    providerEventId: `stub_evt_${kind}`,
  });
}

function memoryTopups() {
  const byId = new Map<string, TopUpIntent>();
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
    async markSucceeded(input: { intentId: string }) {
      const current = byId.get(input.intentId);
      if (!current) throw new Error("missing top-up");
      const next = { ...current, status: "succeeded" as const };
      byId.set(input.intentId, next);
      return next;
    },
  };
}

function memoryLedger() {
  const batches: string[] = [];
  return {
    batches,
    async post(idempotencyKey: string, entries: LedgerPosting[]) {
      batches.push(idempotencyKey);
      return entries;
    },
  };
}

function memoryWithdrawals(initial: WithdrawalIntent) {
  const byId = new Map<string, WithdrawalIntent>([[initial.id, initial]]);
  const calls = { settle: 0, fail: 0 };
  return {
    calls,
    async findById(id: string) {
      return byId.get(id) ?? null;
    },
    async settleVerified(input: { intentId: string }) {
      calls.settle += 1;
      const current = byId.get(input.intentId);
      if (!current) throw new Error("missing withdrawal");
      const next = { ...current, status: "succeeded" as const };
      byId.set(input.intentId, next);
      return { intent: next, entries: [] as LedgerPosting[] };
    },
    async failVerified(input: { intentId: string }) {
      calls.fail += 1;
      const current = byId.get(input.intentId);
      if (!current) throw new Error("missing withdrawal");
      const next = { ...current, status: "failed" as const };
      byId.set(input.intentId, next);
      return { intent: next, entries: [] as LedgerPosting[] };
    },
  };
}

function harness() {
  const topups = memoryTopups();
  const ledger = memoryLedger();
  const withdrawal = markWithdrawalAwaitingProvider(
    createWithdrawalIntent({
      id: "wwd_aud42_payout",
      accountId: "user:usr_buyer",
      amount: 250,
      currency: "EUR",
      providerId: "stub",
      idempotencyKey: "idem_aud42_payout",
      nowIso: "2026-11-27T00:00:00.000Z",
    }),
    "stub_payout_wwd_aud42_payout",
  );
  const withdrawals = memoryWithdrawals(withdrawal);
  const service = new WalletPaymentService(
    [new StubPaymentProvider()],
    topups as never,
    withdrawals as never,
    ledger as never,
  );
  return { service, topups, ledger, withdrawals, withdrawal };
}

async function startTopUp(service: WalletPaymentService) {
  return service.startTopUp({
    accountId: "user:usr_buyer",
    amount: 250,
    currency: "EUR",
    providerId: "stub",
    idempotencyKey: "idem_aud42_topup",
    returnPath: "/workspace/wallet",
    nowIso: "2026-11-27T00:00:00.000Z",
  });
}

function routeRequest() {
  return new NextRequest("https://nexus.test/api/wallet/providers/stub/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...signatureHeaders,
    },
    body: webhookBody("topup_succeeded", "wtop_aud42_http", 500, "EUR"),
  });
}

describe("AUD-42 stub webhook signature", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("credits a top-up after stub-ok outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { service, topups, ledger } = harness();
    const started = await startTopUp(service);

    const credited = await service.applyVerifiedWebhook(
      "stub",
      webhookBody("topup_succeeded", started.intent.id, 250, "EUR"),
      signatureHeaders,
    );

    expect(credited.intent.status).toBe("succeeded");
    expect(credited.entries?.some((entry) => entry.amount === 250)).toBe(true);
    expect(ledger.batches).toEqual([`topup_${started.intent.id}`]);
    expect(await topups.findById(started.intent.id)).toMatchObject({ status: "succeeded" });
  });

  it("closes a payout after stub-ok outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { service, withdrawals, withdrawal } = harness();

    const settled = await service.applyVerifiedWebhook(
      "stub",
      webhookBody("payout_succeeded", withdrawal.id, 250, "EUR"),
      signatureHeaders,
    );

    expect(settled.intent.status).toBe("succeeded");
    expect(settled.kind).toBe("payout_succeeded");
    expect(withdrawals.calls).toEqual({ settle: 1, fail: 0 });
    expect(await withdrawals.findById(withdrawal.id)).toMatchObject({ status: "succeeded" });
  });

  it("rejects stub-ok in production and does not credit the top-up", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { service, topups, ledger } = harness();
    const started = await startTopUp(service);

    await expect(
      service.applyVerifiedWebhook(
        "stub",
        webhookBody("topup_succeeded", started.intent.id, 250, "EUR"),
        signatureHeaders,
      ),
    ).rejects.toMatchObject({
      name: "AppError",
      statusCode: 401,
      code: "STUB_WEBHOOK_UNAUTHORIZED",
    });

    expect(ledger.batches).toEqual([]);
    expect(await topups.findById(started.intent.id)).toMatchObject({
      status: "awaiting_provider",
    });
    expect(process.env.NEXUS_WALLET_ENGINE).not.toBe("1");
  });

  it("rejects stub-ok in production and does not close the payout", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { service, withdrawals, withdrawal } = harness();

    await expect(
      service.applyVerifiedWebhook(
        "stub",
        webhookBody("payout_succeeded", withdrawal.id, 250, "EUR"),
        { "X-Nexus-Stub-Signature": "stub-ok" },
      ),
    ).rejects.toMatchObject({
      statusCode: 401,
      code: "STUB_WEBHOOK_UNAUTHORIZED",
    });

    expect(withdrawals.calls).toEqual({ settle: 0, fail: 0 });
    expect(await withdrawals.findById(withdrawal.id)).toMatchObject({
      status: "awaiting_provider",
    });
  });

  it("rejects the webhook route header in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await webhook(routeRequest(), {
      params: Promise.resolve({ providerId: "stub" }),
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "STUB_WEBHOOK_UNAUTHORIZED" });
    expect(process.env.NEXUS_WALLET_ENGINE).not.toBe("1");
  });

  it("does not reject stub-ok on the webhook route outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const response = await webhook(routeRequest(), {
      params: Promise.resolve({ providerId: "stub" }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_ENGINE_DISABLED" });
  });
});
