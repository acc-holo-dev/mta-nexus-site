import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));
vi.mock("../apps/web/src/lib/services/storage-maintenance-service", () => ({
  storageMaintenanceService: { discover: vi.fn(), cleanup: vi.fn() },
}));

import { POST as discover } from "../apps/web/src/app/api/admin/storage/discovery/route";
import { POST as cleanup } from "../apps/web/src/app/api/admin/storage/objects/[id]/cleanup/route";

const context = { params: Promise.resolve({ id: "smo_a" }) };
const mutations = [
  ["storage discovery", "POST", discover],
  ["storage cleanup", "POST", cleanup],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/admin/storage/discovery", {
    method,
    headers: {
      cookie: "nexus_session=admin",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ ownerId: "usr_a", offset: 0, expectedRevision: 1 }),
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

describe("admin storage handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, method, handler) => {
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
    async (_name, method, handler) => {
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
    async (_name, method, handler) => {
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
