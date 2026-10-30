import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_a",
  getClientIp: () => "unknown",
}));
vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: { claimFreeResource: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/server-claim-service", () => ({
  serverClaimService: { issueChallenge: vi.fn(), verifyChallenge: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/product-service", () => ({
  productService: { transitionResource: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/resource-build-workspace-service", () => ({
  resourceBuildWorkspaceService: { command: vi.fn(), detail: vi.fn() },
}));

import { POST as claim } from "../apps/web/src/app/api/resources/claim/route";
import { POST as issueChallenge } from "../apps/web/src/app/api/servers/[id]/claim-challenge/route";
import { POST as verifyChallenge } from "../apps/web/src/app/api/servers/[id]/claim-challenge/verify/route";
import { POST as lifecycle } from "../apps/web/src/app/api/products/[id]/lifecycle/route";
import { PATCH as versionCommand } from "../apps/web/src/app/api/products/[id]/builds/[buildId]/route";

const serverContext = { params: Promise.resolve({ id: "srv_a" }) };
const productContext = { params: Promise.resolve({ id: "prd_a" }) };
const buildContext = { params: Promise.resolve({ id: "prd_a", buildId: "bld_a" }) };
const mutations = [
  ["free resource claim", "POST", claim, undefined],
  ["server claim challenge", "POST", issueChallenge, serverContext],
  ["server claim verification", "POST", verifyChallenge, serverContext],
  ["resource lifecycle", "POST", lifecycle, productContext],
  ["version command", "PATCH", versionCommand, buildContext],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/resources/publish-or-claim", {
    method,
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ productId: "prd_a", action: "submit" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.stubEnv("TRUSTED_PROXY_SECRET", "trusted-claim-proxy-secret-0123456789abcdef");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("resource publish and claim handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler, context) => {
      const input = request(method);
      const response = await handler(input, context as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler, context) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, context as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler, context) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        context as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
