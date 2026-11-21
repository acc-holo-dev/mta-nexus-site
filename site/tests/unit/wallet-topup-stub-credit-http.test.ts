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
  creditStubTopUp: vi.fn(),
  resolveSellerAccountId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    creditStubTopUp = state.creditStubTopUp;
    resolveSellerAccountId = state.resolveSellerAccountId;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as stubCredit } from "../../src/app/api/wallet/topups/[id]/stub-credit/route";

function request(intentId: string, body: unknown) {
  return new NextRequest(`https://nexus.test/api/wallet/topups/${intentId}/stub-credit`, {
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

describe("wallet top-up stub credit HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.creditStubTopUp.mockReset();
    state.resolveSellerAccountId.mockReset().mockImplementation(async (_actor, organizationId) => {
      return organizationId ? `org:${organizationId}` : "user:usr_wallet";
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays dark when the wallet engine is off", async () => {
    state.engine = false;
    const response = await stubCredit(request("pay_stub_1", { outcome: "succeeded" }), {
      params: Promise.resolve({ id: "pay_stub_1" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_ENGINE_DISABLED" });
    expect(state.creditStubTopUp).not.toHaveBeenCalled();
  });

  it("credits a stub top-up as succeeded", async () => {
    state.creditStubTopUp.mockResolvedValueOnce({
      intent: {
        id: "pay_stub_2",
        status: "succeeded",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
      },
      kind: "topup_succeeded",
      credited: true,
    });
    const response = await stubCredit(request("pay_stub_2", { outcome: "succeeded" }), {
      params: Promise.resolve({ id: "pay_stub_2" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      kind: "topup_succeeded",
      credited: true,
      intent: { id: "pay_stub_2", status: "succeeded" },
    });
  });

  it("marks an organization stub top-up as failed", async () => {
    state.creditStubTopUp.mockResolvedValueOnce({
      intent: {
        id: "pay_stub_org_1",
        status: "failed",
        amount: 250,
        currency: "EUR",
        providerId: "stub",
      },
      kind: "topup_failed",
      credited: false,
    });
    const response = await stubCredit(
      request("pay_stub_org_1", { outcome: "failed", organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "pay_stub_org_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      kind: "topup_failed",
      credited: false,
    });
    expect(state.creditStubTopUp).toHaveBeenCalledWith({
      intentId: "pay_stub_org_1",
      accountId: "org:org_sellers",
      outcome: "failed",
    });
  });
});
