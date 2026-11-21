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
  resolveSellerAccountId: vi.fn(),
  getHeldBalance: vi.fn(),
  listHeld: vi.fn(),
  releaseMaturedHolds: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    resolveSellerAccountId = state.resolveSellerAccountId;
    getHeldBalance = state.getHeldBalance;
    listHeld = state.listHeld;
    releaseMaturedHolds = state.releaseMaturedHolds;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { GET as held } from "../../src/app/api/wallet/held/route";
import { POST as releaseMatured } from "../../src/app/api/wallet/holds/release-matured/route";

function heldRequest(query: string) {
  return new NextRequest(`https://nexus.test/api/wallet/held?${query}`, {
    headers: { cookie: "nexus_session=wallet-token" },
  });
}

function releaseRequest(body: unknown) {
  return new NextRequest("https://nexus.test/api/wallet/holds/release-matured", {
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

describe("wallet org seller holds HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_wallet", role: "user" };
    state.allowed = true;
    state.engine = true;
    state.resolveSellerAccountId.mockReset();
    state.getHeldBalance.mockReset();
    state.listHeld.mockReset();
    state.releaseMaturedHolds.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns organization held proceeds for an authorized seller account", async () => {
    state.resolveSellerAccountId.mockResolvedValueOnce("org:org_sellers");
    state.getHeldBalance.mockResolvedValueOnce(900);
    state.listHeld.mockResolvedValueOnce([
      {
        id: "wsh_1",
        orderId: "ord_1",
        sellerAccountId: "org:org_sellers",
        escrowAccountId: "escrow:wspend_ord_1_hash",
        amount: 900,
        currency: "EUR",
        status: "held",
        heldAt: "2026-11-01T00:00:00.000Z",
        releaseAt: "2026-11-08T00:00:00.000Z",
        holdLedgerBatchId: "lpb_1",
        releaseLedgerBatchId: null,
      },
    ]);

    const response = await held(heldRequest("currency=EUR&organizationId=org_sellers"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      held: 900,
      holds: [{ id: "wsh_1", amount: 900 }],
    });
    expect(state.resolveSellerAccountId).toHaveBeenCalledWith(
      expect.objectContaining({ id: "usr_wallet" }),
      "org_sellers",
    );
  });

  it("rejects organization hold release when the actor cannot manage the org", async () => {
    state.resolveSellerAccountId.mockRejectedValueOnce(
      new ForbiddenError("Not authorized for organization seller holds"),
    );

    const response = await releaseMatured(releaseRequest({ organizationId: "org_sellers" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "FORBIDDEN" });
    expect(state.releaseMaturedHolds).not.toHaveBeenCalled();
  });

  it("releases matured organization holds for an authorized manager", async () => {
    state.resolveSellerAccountId.mockResolvedValueOnce("org:org_sellers");
    state.releaseMaturedHolds.mockResolvedValueOnce([
      {
        id: "wsh_1",
        orderId: "ord_1",
        amount: 900,
        currency: "EUR",
        status: "released",
        releaseLedgerBatchId: "lpb_release",
      },
    ]);

    const response = await releaseMatured(releaseRequest({ organizationId: "org_sellers" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      accountId: "org:org_sellers",
      organizationId: "org_sellers",
      released: [{ id: "wsh_1", status: "released" }],
      actorId: "usr_wallet",
    });
  });
});
