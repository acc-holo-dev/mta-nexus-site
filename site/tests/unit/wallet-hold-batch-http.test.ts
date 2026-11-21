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
  releaseMaturedHoldsBatch: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    releaseMaturedHoldsBatch = state.releaseMaturedHoldsBatch;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as releaseBatch } from "../../src/app/api/admin/commerce/wallet-holds/release-matured/route";

function request(body: unknown, actorId = "usr_admin") {
  return new NextRequest("https://nexus.test/api/admin/commerce/wallet-holds/release-matured", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=wallet-token",
      "x-nexus-actor-id": actorId,
    },
    body: JSON.stringify(body),
  });
}

describe("admin wallet hold batch release HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_admin", role: "admin" };
    state.allowed = true;
    state.engine = true;
    state.releaseMaturedHoldsBatch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects non-admin actors", async () => {
    state.user = { id: "usr_user", role: "user" };
    const response = await releaseBatch(request({}, "usr_user"));
    expect(response.status).toBe(403);
    expect(state.releaseMaturedHoldsBatch).not.toHaveBeenCalled();
  });

  it("releases a matured hold batch for admins", async () => {
    state.releaseMaturedHoldsBatch.mockResolvedValueOnce([
      {
        id: "wsh_1",
        orderId: "ord_1",
        sellerAccountId: "user:usr_seller",
        amount: 900,
        currency: "EUR",
        status: "released",
        releaseLedgerBatchId: "whold_rel_wsh_1",
      },
    ]);

    const response = await releaseBatch(request({ limit: 10 }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      count: 1,
      released: [{ id: "wsh_1", sellerAccountId: "user:usr_seller", status: "released" }],
      actorId: "usr_admin",
    });
    expect(state.releaseMaturedHoldsBatch).toHaveBeenCalledWith({
      nowIso: undefined,
      limit: 10,
    });
  });
});
