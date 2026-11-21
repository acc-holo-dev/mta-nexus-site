import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_wallet", role: "user" } as { id: string; role: string } | null,
  allowed: true,
  engine: true,
  withdraw: false,
  settleStubWithdrawal: vi.fn(),
  resolveSellerAccountId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.engine && state.withdraw,
  WalletPaymentService: class {
    settleStubWithdrawal = state.settleStubWithdrawal;
    resolveSellerAccountId = state.resolveSellerAccountId;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as stubSettle } from "../../src/app/api/wallet/withdrawals/[id]/stub-settle/route";

function request(intentId: string, body: unknown) {
  return new NextRequest(`https://nexus.test/api/wallet/withdrawals/${intentId}/stub-settle`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=wallet-token",
      "x-nexus-actor-id": "usr_wallet",
    },
    body: JSON.stringify(body),
  });
}

describe("wallet withdrawal stub settle HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.withdraw = false;
    state.settleStubWithdrawal.mockReset();
    state.resolveSellerAccountId.mockReset().mockImplementation(async (_actor, organizationId) => {
      return organizationId ? `org:${organizationId}` : "user:usr_wallet";
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays dark when withdraw policy is off", async () => {
    const response = await stubSettle(request("wwd_stub_1", { outcome: "succeeded" }), {
      params: Promise.resolve({ id: "wwd_stub_1" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_WITHDRAW_DISABLED" });
    expect(state.settleStubWithdrawal).not.toHaveBeenCalled();
  });

  it("settles a stub payout as succeeded", async () => {
    state.withdraw = true;
    state.settleStubWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_stub_2",
        status: "succeeded",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_stub_2",
      },
      kind: "payout_succeeded",
      settled: true,
    });
    const response = await stubSettle(request("wwd_stub_2", { outcome: "succeeded" }), {
      params: Promise.resolve({ id: "wwd_stub_2" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      kind: "payout_succeeded",
      settled: true,
      intent: { id: "wwd_stub_2", status: "succeeded" },
    });
  });

  it("settles a stub organization payout as failed", async () => {
    state.withdraw = true;
    state.settleStubWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_stub_org_1",
        status: "failed",
        amount: 250,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_stub_org_1",
      },
      kind: "payout_failed",
      settled: true,
    });
    const response = await stubSettle(
      request("wwd_stub_org_1", { outcome: "failed", organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "wwd_stub_org_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      kind: "payout_failed",
      intent: { id: "wwd_stub_org_1", status: "failed" },
    });
    expect(state.settleStubWithdrawal).toHaveBeenCalledWith({
      intentId: "wwd_stub_org_1",
      accountId: "org:org_sellers",
      outcome: "failed",
    });
  });
});
