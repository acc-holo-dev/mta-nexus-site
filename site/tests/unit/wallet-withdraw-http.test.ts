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
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  isWalletWithdrawEnabled: () => state.engine && state.withdraw,
  WalletPaymentService: class {
    startWithdrawal = state.startWithdrawal;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as withdrawals } from "../../src/app/api/wallet/withdrawals/route";

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

describe("wallet withdrawal HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.withdraw = false;
    state.startWithdrawal.mockReset();
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
      intent: { id: "wwd_1", status: "awaiting_provider" },
      actorId: "usr_wallet",
    });
  });
});
