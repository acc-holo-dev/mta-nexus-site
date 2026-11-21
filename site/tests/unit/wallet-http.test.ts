import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_wallet", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  startTopUp: vi.fn(),
  getAvailableBalance: vi.fn(),
  listRecentActivity: vi.fn(),
  applyVerifiedWebhook: vi.fn(),
  engine: true,
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    startTopUp = state.startTopUp;
    getAvailableBalance = state.getAvailableBalance;
    listRecentActivity = state.listRecentActivity;
    applyVerifiedWebhook = state.applyVerifiedWebhook;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { GET as activity } from "../../src/app/api/wallet/activity/route";
import { GET as balance } from "../../src/app/api/wallet/balance/route";
import { POST as webhook } from "../../src/app/api/wallet/providers/[providerId]/webhook/route";
import { POST as topups } from "../../src/app/api/wallet/topups/route";

function topUpRequest(body: unknown) {
  return new NextRequest("https://nexus.test/api/wallet/topups", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=wallet-token",
    },
    body: JSON.stringify(body),
  });
}

function balanceRequest(query: string) {
  return new NextRequest(`https://nexus.test/api/wallet/balance?${query}`, {
    headers: { cookie: "nexus_session=wallet-token" },
  });
}

function activityRequest(query: string) {
  return new NextRequest(`https://nexus.test/api/wallet/activity?${query}`, {
    headers: { cookie: "nexus_session=wallet-token" },
  });
}

function webhookRequest(providerId: string, body: unknown, signature = "stub-ok") {
  return new NextRequest(`https://nexus.test/api/wallet/providers/${providerId}/webhook`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nexus-stub-signature": signature,
    },
    body: JSON.stringify(body),
  });
}

describe("wallet HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.stubEnv("NEXUS_WALLET_ENGINE", "1");
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.startTopUp.mockReset().mockResolvedValue({
      intent: {
        id: "pay_test_1",
        status: "awaiting_provider",
        amount: 500,
        currency: "EUR",
        providerId: "stub",
        createdAt: "2026-11-21T03:00:00.000Z",
      },
      redirectUrl: null,
    });
    state.getAvailableBalance.mockReset().mockResolvedValue(1200);
    state.listRecentActivity.mockReset().mockResolvedValue([
      {
        id: "ldg_spend_1",
        amount: -400,
        currency: "EUR",
        referenceType: "wallet_spend",
        referenceId: "ord_1",
        balanceAfter: 800,
        description: "Wallet spend",
        createdAt: "2026-11-21T04:00:00.000Z",
      },
    ]);
    state.applyVerifiedWebhook.mockReset().mockResolvedValue({
      intent: {
        id: "pay_test_1",
        status: "succeeded",
        amount: 500,
        currency: "EUR",
        providerId: "stub",
      },
      entries: [{ id: "ldg_1" }],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides wallet routes when the engine flag is off", async () => {
    state.engine = false;
    expect((await balance(balanceRequest("currency=EUR"))).status).toBe(404);
    expect((await activity(activityRequest("currency=EUR"))).status).toBe(404);
    expect((await topups(topUpRequest({}))).status).toBe(404);
    expect(
      (
        await webhook(webhookRequest("stub", {}), {
          params: Promise.resolve({ providerId: "stub" }),
        })
      ).status,
    ).toBe(404);
    expect(state.startTopUp).not.toHaveBeenCalled();
  });

  it("requires a session for balance and top-up", async () => {
    state.user = null;
    expect((await balance(balanceRequest("currency=EUR"))).status).toBe(401);
    expect((await activity(activityRequest("currency=EUR"))).status).toBe(401);
    expect((await topups(topUpRequest({}))).status).toBe(401);
    expect(state.getAvailableBalance).not.toHaveBeenCalled();
    expect(state.listRecentActivity).not.toHaveBeenCalled();
  });

  it("returns available ledger balance for the signed-in user account", async () => {
    const response = await balance(balanceRequest("currency=EUR"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountId: "user:usr_wallet",
      currency: "EUR",
      available: 1200,
    });
    expect(state.getAvailableBalance).toHaveBeenCalledWith("user:usr_wallet", "EUR");
  });

  it("returns recent ledger activity for the signed-in user account", async () => {
    const response = await activity(activityRequest("currency=EUR&limit=10"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      accountId: "user:usr_wallet",
      currency: "EUR",
      entries: [
        {
          id: "ldg_spend_1",
          amount: -400,
          currency: "EUR",
          referenceType: "wallet_spend",
          referenceId: "ord_1",
          balanceAfter: 800,
          description: "Wallet spend",
          createdAt: "2026-11-21T04:00:00.000Z",
        },
      ],
    });
    expect(state.listRecentActivity).toHaveBeenCalledWith("user:usr_wallet", "EUR", 10);
  });

  it("rejects unsupported balance currency", async () => {
    expect((await balance(balanceRequest("currency=BTC"))).status).toBe(400);
    expect(state.getAvailableBalance).not.toHaveBeenCalled();
  });

  it("rejects unsupported activity currency", async () => {
    expect((await activity(activityRequest("currency=BTC"))).status).toBe(400);
    expect(state.listRecentActivity).not.toHaveBeenCalled();
  });

  it("starts a stub top-up for the signed-in account", async () => {
    const response = await topups(
      topUpRequest({
        amount: 500,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_http_topup_1",
        returnPath: "/workspace/finance",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      intent: { id: "pay_test_1", status: "awaiting_provider" },
      redirectUrl: null,
    });
    expect(state.startTopUp).toHaveBeenCalledWith({
      accountId: "user:usr_wallet",
      amount: 500,
      currency: "EUR",
      providerId: "stub",
      idempotencyKey: "idem_http_topup_1",
      returnPath: "/workspace/finance",
    });
  });

  it("rejects open-redirect return paths", async () => {
    const response = await topups(
      topUpRequest({
        amount: 500,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_http_topup_2",
        returnPath: "//evil.example/phish",
      }),
    );
    expect(response.status).toBe(400);
    expect(state.startTopUp).not.toHaveBeenCalled();
  });

  it("applies a verified stub webhook and reports credited", async () => {
    const response = await webhook(
      webhookRequest("stub", {
        kind: "topup_succeeded",
        intentId: "pay_test_1",
        amount: 500,
        currency: "EUR",
        providerEventId: "stub_evt_http_1",
      }),
      { params: Promise.resolve({ providerId: "stub" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      intent: { id: "pay_test_1", status: "succeeded" },
      credited: true,
    });
    expect(state.applyVerifiedWebhook).toHaveBeenCalledWith(
      "stub",
      expect.stringContaining("stub_evt_http_1"),
      expect.objectContaining({ "x-nexus-stub-signature": "stub-ok" }),
    );
  });

  it("rejects unknown provider webhook paths", async () => {
    const response = await webhook(webhookRequest("paypal", {}), {
      params: Promise.resolve({ providerId: "paypal" }),
    });
    expect(response.status).toBe(400);
    expect(state.applyVerifiedWebhook).not.toHaveBeenCalled();
  });

  it("preserves provider AppError codes on webhook failure", async () => {
    state.applyVerifiedWebhook.mockRejectedValue(
      new AppError("Stub webhook signature rejected", 401, "STUB_WEBHOOK_UNAUTHORIZED"),
    );
    const response = await webhook(webhookRequest("stub", { kind: "topup_succeeded" }, "bad"), {
      params: Promise.resolve({ providerId: "stub" }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "STUB_WEBHOOK_UNAUTHORIZED" });
  });

  it("rate limits wallet reads and mutations before service work", async () => {
    state.allowed = false;
    expect((await balance(balanceRequest("currency=EUR"))).status).toBe(429);
    expect((await activity(activityRequest("currency=EUR"))).status).toBe(429);
    expect((await topups(topUpRequest({ amount: 1 }))).status).toBe(429);
    expect(state.getAvailableBalance).not.toHaveBeenCalled();
    expect(state.listRecentActivity).not.toHaveBeenCalled();
    expect(state.startTopUp).not.toHaveBeenCalled();
  });
});
