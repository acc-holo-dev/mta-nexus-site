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
  grantStaffBalance: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));

vi.mock("../../src/lib/services/commerce/wallet-payment-service", () => ({
  isWalletEngineEnabled: () => state.engine,
  WalletPaymentService: class {
    grantStaffBalance = state.grantStaffBalance;
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: async () => ({ success: state.allowed }),
  getClientIp: () => "127.0.0.1",
}));

import { POST as grant } from "../../src/app/api/admin/commerce/wallet-grants/route";

const body = {
  username: "member",
  amount: 1500,
  currency: "RUB",
  reason: "Beta support credit",
  idempotencyKey: "grant_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

function request(payload: unknown = body, actorId = "usr_admin") {
  return new NextRequest("https://nexus.test/api/admin/commerce/wallet-grants", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=wallet-token",
      "x-nexus-actor-id": actorId,
    },
    body: JSON.stringify(payload),
  });
}

describe("admin staff wallet grant HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    state.user = { id: "usr_admin", role: "admin" };
    state.allowed = true;
    state.engine = true;
    state.grantStaffBalance.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a non-admin", async () => {
    state.user = { id: "usr_user", role: "user" };
    const response = await grant(request(body, "usr_user"));
    expect(response.status).toBe(403);
    expect(state.grantStaffBalance).not.toHaveBeenCalled();
  });

  it("stays dark when the wallet engine is off", async () => {
    state.engine = false;
    const response = await grant(request());
    expect(response.status).toBe(404);
    expect(state.grantStaffBalance).not.toHaveBeenCalled();
  });

  it("credits the named member for an admin", async () => {
    state.grantStaffBalance.mockResolvedValueOnce({
      grantId: `wgr_${"b".repeat(24)}`,
      username: "member",
      accountId: "user:usr_member",
      amount: 1500,
      currency: "RUB",
      available: 1500,
      actorId: "usr_admin",
    });
    const response = await grant(request());
    expect(response.status).toBe(200);
    expect(state.grantStaffBalance).toHaveBeenCalledWith({
      actor: { id: "usr_admin", role: "admin" },
      username: "member",
      amount: 1500,
      currency: "RUB",
      reason: "Beta support credit",
      idempotencyKey: "grant_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    });
  });

  it("rejects a reason that is too short", async () => {
    const response = await grant(request({ ...body, reason: "short" }));
    expect(response.status).toBe(400);
    expect(state.grantStaffBalance).not.toHaveBeenCalled();
  });
});
