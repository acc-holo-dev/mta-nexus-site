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
  settle: vi.fn(),
  engine: true,
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    settleOrderFromWallet = state.settle;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as payWithWallet } from "../../src/app/api/orders/[id]/pay-with-wallet/route";

function payRequest(orderId: string, actorId?: string) {
  const headers: Record<string, string> = {
    ...browserMutationHeaders(),
    "content-type": "application/json",
    cookie: "nexus_session=wallet-token",
  };
  if (actorId) headers["x-nexus-actor-id"] = actorId;
  return new NextRequest(`https://nexus.test/api/orders/${orderId}/pay-with-wallet`, {
    method: "POST",
    headers,
    body: "{}",
  });
}

describe("pay-with-wallet HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.stubEnv("NEXUS_WALLET_ENGINE", "1");
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.settle.mockReset().mockResolvedValue({
      orderId: "ord_wallet_1",
      paymentId: "pay_wallet_ord_wallet_1",
      ledgerBatchId: "wspend_ord_wallet_1",
      status: "completed",
      totalAmount: 900,
      currency: "EUR",
      alreadySettled: false,
      entitlementIds: ["ent_a"],
      entries: [],
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides the route when the wallet engine is off", async () => {
    state.engine = false;
    expect(
      (
        await payWithWallet(payRequest("ord_wallet_1", "usr_wallet"), {
          params: Promise.resolve({ id: "ord_wallet_1" }),
        })
      ).status,
    ).toBe(404);
    expect(state.settle).not.toHaveBeenCalled();
  });

  it("requires actor precondition and session", async () => {
    expect(
      (
        await payWithWallet(payRequest("ord_wallet_1"), {
          params: Promise.resolve({ id: "ord_wallet_1" }),
        })
      ).status,
    ).toBe(428);
    state.user = null;
    expect(
      (
        await payWithWallet(payRequest("ord_wallet_1", "usr_wallet"), {
          params: Promise.resolve({ id: "ord_wallet_1" }),
        })
      ).status,
    ).toBe(401);
    expect(state.settle).not.toHaveBeenCalled();
  });

  it("settles a pending order from the site wallet", async () => {
    const response = await payWithWallet(payRequest("ord_wallet_1", "usr_wallet"), {
      params: Promise.resolve({ id: "ord_wallet_1" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderId: "ord_wallet_1",
      status: "completed",
      totalAmount: 900,
      currency: "EUR",
      alreadySettled: false,
      actorId: "usr_wallet",
    });
    expect(state.settle).toHaveBeenCalledWith({
      user: state.user,
      currentToken: "wallet-token",
      orderId: "ord_wallet_1",
    });
  });

  it("preserves insufficient-funds codes from settlement", async () => {
    state.settle.mockRejectedValue(
      new AppError("Insufficient wallet balance", 409, "WALLET_INSUFFICIENT_FUNDS"),
    );
    const response = await payWithWallet(payRequest("ord_wallet_1", "usr_wallet"), {
      params: Promise.resolve({ id: "ord_wallet_1" }),
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "WALLET_INSUFFICIENT_FUNDS" });
  });
});
