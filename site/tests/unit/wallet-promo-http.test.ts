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
  createPromoCode: vi.fn(),
  quoteWalletPromo: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    createPromoCode = state.createPromoCode;
    quoteWalletPromo = state.quoteWalletPromo;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as createPromo } from "../../src/app/api/admin/commerce/promo-codes/route";
import { POST as quotePromo } from "../../src/app/api/checkout/wallet/promo-quote/route";

function request(url: string, body: unknown, actorId: string) {
  return new NextRequest(url, {
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

describe("promo HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.stubEnv("NEXUS_WALLET_ENGINE", "1");
    state.user = { id: "usr_admin", role: "admin" };
    state.allowed = true;
    state.engine = true;
    state.createPromoCode.mockReset().mockResolvedValue({
      code: "LAUNCH10",
      kind: "percent",
      percent: 10,
      amount: null,
      currency: null,
      active: true,
      maxRedemptions: null,
      redemptionCount: 0,
      startsAt: null,
      endsAt: null,
    });
    state.quoteWalletPromo.mockReset().mockResolvedValue({
      code: "LAUNCH10",
      kind: "percent",
      percent: 10,
      listAmount: 1000,
      discountAmount: 100,
      chargedAmount: 900,
      currency: "RUB",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("hides promo creation when the engine is off", async () => {
    state.engine = false;
    const response = await createPromo(
      request(
        "https://nexus.test/api/admin/commerce/promo-codes",
        { code: "LAUNCH10", kind: "percent", percent: 10 },
        "usr_admin",
      ),
    );
    expect(response.status).toBe(404);
    expect(state.createPromoCode).not.toHaveBeenCalled();
  });

  it("refuses a non-admin create", async () => {
    state.user = { id: "usr_member", role: "user" };
    const response = await createPromo(
      request(
        "https://nexus.test/api/admin/commerce/promo-codes",
        { code: "LAUNCH10", kind: "percent", percent: 10 },
        "usr_member",
      ),
    );
    expect(response.status).toBe(403);
    expect(state.createPromoCode).not.toHaveBeenCalled();
  });

  it("creates a percent code for an admin", async () => {
    const response = await createPromo(
      request(
        "https://nexus.test/api/admin/commerce/promo-codes",
        { code: "launch10", kind: "percent", percent: 10 },
        "usr_admin",
      ),
    );
    expect(response.status).toBe(200);
    expect(state.createPromoCode).toHaveBeenCalledWith(
      expect.objectContaining({ code: "launch10", kind: "percent", percent: 10 }),
    );
  });

  it("quotes a code without reserving it", async () => {
    state.user = { id: "usr_buyer", role: "user" };
    const response = await quotePromo(
      request(
        "https://nexus.test/api/checkout/wallet/promo-quote",
        { productIds: ["prd_a"], promoCode: "LAUNCH10" },
        "usr_buyer",
      ),
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "LAUNCH10",
      listAmount: 1000,
      discountAmount: 100,
      chargedAmount: 900,
    });
    expect(state.quoteWalletPromo).toHaveBeenCalledOnce();
  });
});
