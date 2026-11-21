import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_admin", role: "admin" } as { id: string; role: string } | null,
  allowed: true,
  engine: true,
  refundWalletOrder: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    refundWalletOrder = state.refundWalletOrder;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as refundOrder } from "../../src/app/api/admin/commerce/wallet-orders/[orderId]/refund/route";

function request(orderId: string) {
  return new NextRequest(`https://nexus.test/api/admin/commerce/wallet-orders/${orderId}/refund`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=admin-token",
      "x-nexus-actor-id": "usr_admin",
    },
    body: "{}",
  });
}

describe("wallet order refund HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_admin", role: "admin" };
    state.allowed = true;
    state.engine = true;
    state.refundWalletOrder.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stays dark when the wallet engine is off", async () => {
    state.engine = false;
    const response = await refundOrder(request("ord_refund_dark"), {
      params: Promise.resolve({ orderId: "ord_refund_dark" }),
    });
    expect(response.status).toBe(404);
    expect(state.refundWalletOrder).not.toHaveBeenCalled();
  });

  it("rejects non-admin actors", async () => {
    state.user = { id: "usr_admin", role: "user" };
    const response = await refundOrder(request("ord_refund_forbid"), {
      params: Promise.resolve({ orderId: "ord_refund_forbid" }),
    });
    expect(response.status).toBe(403);
    expect(state.refundWalletOrder).not.toHaveBeenCalled();
  });

  it("refunds a completed wallet order for admin", async () => {
    state.refundWalletOrder.mockResolvedValueOnce({
      orderId: "ord_refund_ok",
      paymentId: "pay_wallet_ord_refund_ok",
      ledgerBatchId: "wrefund_ord_refund_ok",
      status: "refunded",
      totalAmount: 1000,
      currency: "EUR",
      alreadyRefunded: false,
      cancelledHoldIds: ["whold_1"],
      clawedBackHoldIds: [],
      expiredEntitlementIds: ["ent_1"],
    });
    const response = await refundOrder(request("ord_refund_ok"), {
      params: Promise.resolve({ orderId: "ord_refund_ok" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      orderId: "ord_refund_ok",
      status: "refunded",
      alreadyRefunded: false,
      cancelledHoldIds: ["whold_1"],
      actorId: "usr_admin",
    });
    expect(state.refundWalletOrder).toHaveBeenCalledWith({
      actor: expect.objectContaining({ id: "usr_admin", role: "admin" }),
      orderId: "ord_refund_ok",
    });
  });
});
