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
  checkout: vi.fn(),
  engine: true,
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    checkoutAndSettleFromWallet = state.checkout;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as checkoutWallet } from "../../src/app/api/checkout/wallet/route";

function checkoutRequest(body: unknown, actorId?: string) {
  const headers: Record<string, string> = {
    ...browserMutationHeaders(),
    "content-type": "application/json",
    cookie: "nexus_session=wallet-token",
  };
  if (actorId) headers["x-nexus-actor-id"] = actorId;
  return new NextRequest("https://nexus.test/api/checkout/wallet", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("checkout/wallet HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.stubEnv("NEXUS_WALLET_ENGINE", "1");
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.checkout.mockReset().mockResolvedValue({
      orderId: "ord_wallet_1",
      orderNumber: "NEXUS-WALLET01",
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
      (await checkoutWallet(checkoutRequest({ productIds: ["prd_a"] }, "usr_wallet"))).status,
    ).toBe(404);
    expect(state.checkout).not.toHaveBeenCalled();
  });

  it("requires actor precondition", async () => {
    expect((await checkoutWallet(checkoutRequest({ productIds: ["prd_a"] }))).status).toBe(428);
    expect(state.checkout).not.toHaveBeenCalled();
  });

  it("creates and settles a paid order from the site wallet", async () => {
    const response = await checkoutWallet(
      checkoutRequest({ productIds: ["prd_paid_1"] }, "usr_wallet"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderId: "ord_wallet_1",
      orderNumber: "NEXUS-WALLET01",
      status: "completed",
      totalAmount: 900,
      currency: "EUR",
      actorId: "usr_wallet",
    });
    expect(state.checkout).toHaveBeenCalledWith({
      user: state.user,
      currentToken: "wallet-token",
      productIds: ["prd_paid_1"],
    });
  });

  it("rejects empty product sets before service work", async () => {
    expect((await checkoutWallet(checkoutRequest({ productIds: [] }, "usr_wallet"))).status).toBe(
      400,
    );
    expect(state.checkout).not.toHaveBeenCalled();
  });

  it("preserves insufficient-funds codes", async () => {
    state.checkout.mockRejectedValue(
      new AppError("Insufficient wallet balance", 409, "WALLET_INSUFFICIENT_FUNDS"),
    );
    const response = await checkoutWallet(
      checkoutRequest({ productIds: ["prd_paid_1"] }, "usr_wallet"),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "WALLET_INSUFFICIENT_FUNDS" });
  });
});
