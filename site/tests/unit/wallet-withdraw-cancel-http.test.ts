import { ForbiddenError } from "@nexus/domain";
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
  cancelWithdrawal: vi.fn(),
  resolveSellerAccountId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.engine && state.withdraw,
  WalletPaymentService: class {
    cancelWithdrawal = state.cancelWithdrawal;
    resolveSellerAccountId = state.resolveSellerAccountId;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as cancelWithdrawal } from "../../src/app/api/wallet/withdrawals/[id]/cancel/route";

function request(intentId: string, body: unknown = {}) {
  return new NextRequest(`https://nexus.test/api/wallet/withdrawals/${intentId}/cancel`, {
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

describe("wallet withdrawal cancel HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.withdraw = false;
    state.cancelWithdrawal.mockReset();
    state.resolveSellerAccountId.mockReset().mockImplementation(async (_actor, organizationId) => {
      return organizationId ? `org:${organizationId}` : "user:usr_wallet";
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays dark when withdraw policy is off", async () => {
    const response = await cancelWithdrawal(request("wwd_cancel_1"), {
      params: Promise.resolve({ id: "wwd_cancel_1" }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_WITHDRAW_DISABLED" });
    expect(state.cancelWithdrawal).not.toHaveBeenCalled();
  });

  it("cancels an awaiting personal withdrawal", async () => {
    state.withdraw = true;
    state.cancelWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_cancel_2",
        status: "cancelled",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_cancel_2",
      },
    });
    const response = await cancelWithdrawal(request("wwd_cancel_2"), {
      params: Promise.resolve({ id: "wwd_cancel_2" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      intent: { id: "wwd_cancel_2", status: "cancelled" },
      actorId: "usr_wallet",
    });
    expect(state.cancelWithdrawal).toHaveBeenCalledWith({
      intentId: "wwd_cancel_2",
      accountId: "user:usr_wallet",
    });
  });

  it("cancels an organization withdrawal for owner/admin", async () => {
    state.withdraw = true;
    state.cancelWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_cancel_org_1",
        status: "cancelled",
        amount: 250,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_cancel_org_1",
      },
    });
    const response = await cancelWithdrawal(
      request("wwd_cancel_org_1", { organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "wwd_cancel_org_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      intent: { id: "wwd_cancel_org_1", status: "cancelled" },
    });
  });

  it("rejects cancel when organization membership is insufficient", async () => {
    state.withdraw = true;
    state.resolveSellerAccountId.mockRejectedValueOnce(
      new ForbiddenError("Not authorized for organization seller holds"),
    );
    const response = await cancelWithdrawal(
      request("wwd_cancel_org_2", { organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "wwd_cancel_org_2" }) },
    );
    expect(response.status).toBe(403);
    expect(state.cancelWithdrawal).not.toHaveBeenCalled();
  });
});
