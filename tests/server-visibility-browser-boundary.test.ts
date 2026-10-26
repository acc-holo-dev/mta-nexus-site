import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("../apps/web/src/lib/services/server-service", () => ({
  serverService: {
    previewVisibility: vi.fn(),
    saveVisibility: vi.fn(),
  },
}));

import { POST as previewVisibility } from "../apps/web/src/app/api/workspace/servers/visibility/preview/route";
import { POST as saveVisibility } from "../apps/web/src/app/api/workspace/servers/visibility/route";

const mutations = [
  ["server visibility preview", previewVisibility],
  ["server visibility save", saveVisibility],
] as const;

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/workspace/servers/visibility", {
    method: "POST",
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ serverIds: ["srv_a"], visibility: "private" }),
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

describe("server visibility handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, handler) => {
      const input = request();
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (_name, handler) => {
      const input = request({
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expect(authService.getSession).not.toHaveBeenCalled();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s request and reaches session resolution",
    async (_name, handler) => {
      const response = await handler(
        request({ origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
