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
  cancelTopUp: vi.fn(),
  resolveSellerAccountId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    cancelTopUp = state.cancelTopUp;
    resolveSellerAccountId = state.resolveSellerAccountId;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as cancelTopUp } from "../../src/app/api/wallet/topups/[id]/cancel/route";

function request(intentId: string, body: unknown = {}) {
  return new NextRequest(`https://nexus.test/api/wallet/topups/${intentId}/cancel`, {
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

describe("wallet top-up cancel HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.cancelTopUp.mockReset();
    state.resolveSellerAccountId.mockReset().mockImplementation(async (_actor, organizationId) => {
      return organizationId ? `org:${organizationId}` : "user:usr_wallet";
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("cancels an awaiting personal top-up", async () => {
    state.cancelTopUp.mockResolvedValueOnce({
      intent: {
        id: "wtop_cancel_2",
        status: "cancelled",
        amount: 100,
        currency: "EUR",
        providerId: "stub",
      },
    });
    const response = await cancelTopUp(request("wtop_cancel_2"), {
      params: Promise.resolve({ id: "wtop_cancel_2" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "user:usr_wallet",
      organizationId: null,
      intent: { id: "wtop_cancel_2", status: "cancelled" },
      actorId: "usr_wallet",
    });
    expect(state.cancelTopUp).toHaveBeenCalledWith({
      intentId: "wtop_cancel_2",
      accountId: "user:usr_wallet",
    });
  });

  it("cancels an organization top-up for owner/admin", async () => {
    state.cancelTopUp.mockResolvedValueOnce({
      intent: {
        id: "wtop_cancel_org_1",
        status: "cancelled",
        amount: 250,
        currency: "EUR",
        providerId: "stub",
      },
    });
    const response = await cancelTopUp(
      request("wtop_cancel_org_1", { organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "wtop_cancel_org_1" }) },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      intent: { id: "wtop_cancel_org_1", status: "cancelled" },
    });
  });

  it("rejects cancel when organization membership is insufficient", async () => {
    state.resolveSellerAccountId.mockRejectedValueOnce(
      new ForbiddenError("Not authorized for organization seller holds"),
    );
    const response = await cancelTopUp(
      request("wtop_cancel_org_2", { organizationId: "org_sellers" }),
      { params: Promise.resolve({ id: "wtop_cancel_org_2" }) },
    );
    expect(response.status).toBe(403);
    expect(state.cancelTopUp).not.toHaveBeenCalled();
  });
});
