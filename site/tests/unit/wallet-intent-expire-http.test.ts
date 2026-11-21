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
  withdraw: true,
  expireStaleTopUps: vi.fn(),
  expireStaleWithdrawals: vi.fn(),
  expireStalePendingOrders: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.engine && state.withdraw,
  WalletPaymentService: class {
    expireStaleTopUps = state.expireStaleTopUps;
    expireStaleWithdrawals = state.expireStaleWithdrawals;
    expireStalePendingOrders = state.expireStalePendingOrders;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as expireOrders } from "../../src/app/api/admin/commerce/wallet-orders/expire-stale/route";
import { POST as expireTopUps } from "../../src/app/api/admin/commerce/wallet-topups/expire-stale/route";
import { POST as expireWithdrawals } from "../../src/app/api/admin/commerce/wallet-withdrawals/expire-stale/route";

function request(path: string, body: unknown = {}, actorId = "usr_admin") {
  return new NextRequest(`https://nexus.test${path}`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=admin-token",
      "x-nexus-actor-id": actorId,
    },
    body: JSON.stringify(body),
  });
}

describe("admin wallet intent expiry HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_admin", role: "admin" };
    state.allowed = true;
    state.engine = true;
    state.withdraw = true;
    state.expireStaleTopUps.mockReset();
    state.expireStaleWithdrawals.mockReset();
    state.expireStalePendingOrders.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-admin top-up expiry", async () => {
    state.user = { id: "usr_user", role: "user" };
    const response = await expireTopUps(
      request("/api/admin/commerce/wallet-topups/expire-stale", {}, "usr_user"),
    );
    expect(response.status).toBe(403);
    expect(state.expireStaleTopUps).not.toHaveBeenCalled();
  });

  it("expires stale top-ups for admins", async () => {
    state.expireStaleTopUps.mockResolvedValueOnce([
      {
        id: "wtop_stale_1",
        status: "failed",
        amount: 100,
        currency: "EUR",
        accountId: "user:usr_buyer",
        providerId: "stub",
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    const response = await expireTopUps(
      request("/api/admin/commerce/wallet-topups/expire-stale", { limit: 10 }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      count: 1,
      expired: [{ id: "wtop_stale_1", status: "failed" }],
      actorId: "usr_admin",
    });
    expect(state.expireStaleTopUps).toHaveBeenCalledWith({
      nowIso: undefined,
      maxAgeMs: undefined,
      limit: 10,
    });
  });

  it("keeps withdrawal expiry dark when withdraw policy is off", async () => {
    state.withdraw = false;
    const response = await expireWithdrawals(
      request("/api/admin/commerce/wallet-withdrawals/expire-stale", {}),
    );
    expect(response.status).toBe(404);
    expect(state.expireStaleWithdrawals).not.toHaveBeenCalled();
  });

  it("expires stale withdrawals for admins when withdraw is on", async () => {
    state.expireStaleWithdrawals.mockResolvedValueOnce([
      {
        id: "wwd_stale_1",
        status: "cancelled",
        amount: 200,
        currency: "EUR",
        accountId: "user:usr_seller",
        providerId: "stub",
        escrowAccountId: "escrow:wwithdraw_wwd_stale_1",
        createdAt: "2026-11-01T00:00:00.000Z",
      },
    ]);
    const response = await expireWithdrawals(
      request("/api/admin/commerce/wallet-withdrawals/expire-stale", { limit: 5 }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      count: 1,
      expired: [{ id: "wwd_stale_1", status: "cancelled" }],
    });
  });

  it("rejects non-admin unpaid order expiry", async () => {
    state.user = { id: "usr_user", role: "user" };
    const response = await expireOrders(
      request("/api/admin/commerce/wallet-orders/expire-stale", {}, "usr_user"),
    );
    expect(response.status).toBe(403);
    expect(state.expireStalePendingOrders).not.toHaveBeenCalled();
  });

  it("expires stale unpaid pending orders for admins", async () => {
    const createdAt = new Date("2026-11-01T00:00:00.000Z");
    const cancelledAt = new Date("2026-11-08T00:00:00.000Z");
    state.expireStalePendingOrders.mockResolvedValueOnce([
      {
        id: "ord_stale_1",
        orderNumber: "N-1001",
        buyerId: "usr_buyer",
        status: "cancelled",
        totalAmount: 500,
        currency: "EUR",
        createdAt,
        cancelledAt,
      },
    ]);
    const response = await expireOrders(
      request("/api/admin/commerce/wallet-orders/expire-stale", { limit: 10 }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      count: 1,
      expired: [
        {
          id: "ord_stale_1",
          orderNumber: "N-1001",
          status: "cancelled",
          createdAt: createdAt.toISOString(),
          cancelledAt: cancelledAt.toISOString(),
        },
      ],
      actorId: "usr_admin",
    });
    expect(state.expireStalePendingOrders).toHaveBeenCalledWith({
      actorId: "usr_admin",
      nowIso: undefined,
      maxAgeMs: undefined,
      limit: 10,
    });
  });
});
