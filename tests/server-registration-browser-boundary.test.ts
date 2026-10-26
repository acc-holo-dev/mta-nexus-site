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
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: { createServer: vi.fn(), updateServer: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/mta-master-directory-service", () => ({
  mtaMasterDirectoryService: { getDirectory: vi.fn() },
  indexMtaObservations: vi.fn(),
  matchesMtaEndpoint: vi.fn(),
  mtaLiveStatus: vi.fn(),
}));

import { POST as registerServer } from "../apps/web/src/app/api/servers/route";
import { PATCH as updateServer } from "../apps/web/src/app/api/servers/[id]/route";

const context = { params: Promise.resolve({ id: "srv_a" }) };
const mutations = [
  ["server registration", "POST", registerServer, undefined],
  ["server edit", "PATCH", updateServer, context],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/servers/srv_a", {
    method,
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      name: "Nexus",
      slug: "nexus",
      ipAddress: "203.0.113.7",
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.stubEnv("TRUSTED_PROXY_SECRET", "trusted-server-proxy-secret-0123456789abcdef");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  authService.getSession.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("server registration handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler, routeContext) => {
      const input = request(method);
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, method, handler, routeContext) => {
      const input = request(method, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input, routeContext as never);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, method, handler, routeContext) => {
      const response = await handler(
        request(method, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        routeContext as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
