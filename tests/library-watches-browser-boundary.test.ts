import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_a",
}));
vi.mock("../apps/web/src/lib/services/resource-release-control-service", () => ({
  libraryReleaseService: {
    detail: vi.fn(),
    command: vi.fn(),
    page: vi.fn(),
  },
}));
vi.mock("../apps/web/src/lib/services/resource-release-watches-service", () => ({
  resourceReleaseWatchesService: {
    detail: vi.fn(),
    command: vi.fn(),
    disableBatch: vi.fn(),
    resumeBatch: vi.fn(),
  },
}));

import { POST as selectRelease } from "../apps/web/src/app/api/library/releases/[id]/route";
import { POST as watchCommand } from "../apps/web/src/app/api/library/watches/[id]/route";
import { POST as disableWatches } from "../apps/web/src/app/api/library/watches/disable/route";
import { POST as resumeWatches } from "../apps/web/src/app/api/library/watches/resume/route";

const context = { params: Promise.resolve({ id: "prd_a" }) };
const mutations = [
  ["library release selection", selectRelease, context],
  ["library watch command", watchCommand, context],
  ["library watch disable", disableWatches, undefined],
  ["library watch resume", resumeWatches, undefined],
] as const;

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/library/watches/prd_a", {
    method: "POST",
    headers: {
      cookie: "nexus_session=owner",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ enabled: true, expectedRevision: 0 }),
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

describe("library watch and release handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, handler, routeContext) => {
      const input = request();
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
    async (_name, handler, routeContext) => {
      const input = request({
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
    async (_name, handler, routeContext) => {
      const response = await handler(
        request({ origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
        routeContext as never,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
