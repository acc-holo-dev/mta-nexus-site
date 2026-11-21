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
  startWithdrawal: vi.fn(),
  listRecentWithdrawals: vi.fn(),
  resolveSellerAccountId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.engine && state.withdraw,
  WalletPaymentService: class {
    startWithdrawal = state.startWithdrawal;
    listRecentWithdrawals = state.listRecentWithdrawals;
    resolveSellerAccountId = state.resolveSellerAccountId;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import {
  GET as listWithdrawals,
  POST as withdrawals,
} from "../../src/app/api/wallet/withdrawals/route";

function request(body: unknown) {
  return new NextRequest("https://nexus.test/api/wallet/withdrawals", {
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

function listRequest(query: string) {
  return new NextRequest(`https://nexus.test/api/wallet/withdrawals?${query}`, {
    headers: { cookie: "nexus_session=wallet-token" },
  });
}

describe("wallet withdrawal HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.withdraw = false;
    state.startWithdrawal.mockReset();
    state.listRecentWithdrawals.mockReset();
    state.resolveSellerAccountId.mockReset().mockImplementation(async (_actor, organizationId) => {
      return organizationId ? `org:${organizationId}` : "user:usr_wallet";
    });
  });

  it("keeps withdrawal history dark when withdraw policy is off", async () => {
    const response = await listWithdrawals(listRequest("currency=EUR"));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_WITHDRAW_DISABLED" });
    expect(state.listRecentWithdrawals).not.toHaveBeenCalled();
  });

  it("lists recent withdrawal intents when withdraw policy is on", async () => {
    state.withdraw = true;
    state.listRecentWithdrawals.mockResolvedValueOnce([
      {
        id: "wwd_1",
        status: "awaiting_provider",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_1",
        createdAt: "2026-11-21T08:00:00.000Z",
      },
    ]);
    const response = await listWithdrawals(listRequest("currency=EUR"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      currency: "EUR",
      withdrawals: [{ id: "wwd_1", status: "awaiting_provider", amount: 100 }],
    });
  });

  it("lists organization withdrawal intents for owner/admin", async () => {
    state.withdraw = true;
    state.listRecentWithdrawals.mockResolvedValueOnce([
      {
        id: "wwd_org_1",
        status: "awaiting_provider",
        amount: 250,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_org_1",
        createdAt: "2026-11-21T08:10:00.000Z",
      },
    ]);
    const response = await listWithdrawals(listRequest("currency=EUR&organizationId=org_sellers"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      withdrawals: [{ id: "wwd_org_1", amount: 250 }],
    });
    expect(state.resolveSellerAccountId).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_wallet" }),
      "org_sellers",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays dark when withdraw policy is off", async () => {
    const response = await withdrawals(
      request({
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_wdraw_1",
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "WALLET_WITHDRAW_DISABLED" });
    expect(state.startWithdrawal).not.toHaveBeenCalled();
  });

  it("starts a withdrawal hold when withdraw policy is on", async () => {
    state.withdraw = true;
    state.startWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_1",
        status: "awaiting_provider",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_1",
      },
    });

    const response = await withdrawals(
      request({
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_wdraw_2",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      intent: { id: "wwd_1", status: "awaiting_provider" },
      actorId: "usr_wallet",
    });
  });

  it("starts an organization withdrawal hold for owner/admin", async () => {
    state.withdraw = true;
    state.startWithdrawal.mockResolvedValueOnce({
      intent: {
        id: "wwd_org_2",
        status: "awaiting_provider",
        amount: 300,
        currency: "EUR",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_org_2",
      },
    });

    const response = await withdrawals(
      request({
        amount: 300,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_wdraw_org_1",
        organizationId: "org_sellers",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      intent: { id: "wwd_org_2", amount: 300 },
    });
    expect(state.startWithdrawal).toHaveBeenCalledWith(
      expect.objectContaining({ accountId: "org:org_sellers", amount: 300 }),
    );
  });

  it("rejects organization withdrawal when membership is insufficient", async () => {
    state.withdraw = true;
    state.resolveSellerAccountId.mockRejectedValueOnce(
      new ForbiddenError("Not authorized for organization seller holds"),
    );
    const response = await withdrawals(
      request({
        amount: 100,
        currency: "EUR",
        providerId: "stub",
        idempotencyKey: "idem_wdraw_org_denied",
        organizationId: "org_sellers",
      }),
    );
    expect(response.status).toBe(403);
    expect(state.startWithdrawal).not.toHaveBeenCalled();
  });
});
