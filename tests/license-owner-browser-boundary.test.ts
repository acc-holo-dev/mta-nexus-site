import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("../apps/web/src/lib/services/license-control-service", () => ({
  licenseControlService: { ownerCommand: vi.fn() },
}));

import { POST as ownerAction } from "../apps/web/src/app/api/licenses/[id]/actions/route";

const context = { params: Promise.resolve({ id: "lic_a" }) };

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/licenses/lic_a/actions", {
    method: "POST",
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      action: "revoke",
      expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
      reason: "Revoke this license",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("license owner actions enforce the browser boundary independently of Proxy", () => {
  it("rejects a missing Origin before session or body reads", async () => {
    const input = request();
    const response = await ownerAction(input, context);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(input.bodyUsed).toBe(false);
    expect(authService.getSession).not.toHaveBeenCalled();
  });

  it("rejects a cross-site Origin even with a bearer token", async () => {
    const input = request({
      origin: "https://evil.test",
      authorization: "Bearer forged",
    });
    const response = await ownerAction(input, context);
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
    expect(input.bodyUsed).toBe(false);
    expect(authService.getSession).not.toHaveBeenCalled();
  });

  it("accepts a same-origin request and reaches session resolution", async () => {
    const response = await ownerAction(
      request({ origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
      context,
    );
    expect(authService.getSession).toHaveBeenCalledOnce();
    const body = await response.json();
    expect(body.code).not.toBe("CSRF_REJECTED");
  });
});
