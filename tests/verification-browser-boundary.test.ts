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
vi.mock("@nexus/db", () => ({
  verificationRepository: {
    listByRequester: vi.fn(),
    findPendingForTarget: vi.fn(),
    createRequest: vi.fn(),
  },
  organizationRepository: { findById: vi.fn(), listUserMemberships: vi.fn() },
  userRepository: { listModeratorIds: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: {
    overview: vi.fn(),
    apply: vi.fn(),
    application: vi.fn(),
    amend: vi.fn(),
  },
}));

import { POST as createPublicRequest } from "../apps/web/src/app/api/verification/route";
import { POST as createWorkspaceRequest } from "../apps/web/src/app/api/workspace/verification/route";
import { PATCH as amendRequest } from "../apps/web/src/app/api/workspace/verification/[id]/route";

const context = { params: Promise.resolve({ id: "ver_a" }) };
const mutations = [
  ["public verification", "POST", createPublicRequest],
  ["workspace verification", "POST", createWorkspaceRequest],
  ["verification amendment", "PATCH", amendRequest],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/verification", {
    method,
    headers: {
      cookie: "nexus_session=member",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({
      targetType: "developer",
      targetId: "usr_a",
      proofUrl: "https://example.test/evidence",
      notes: "Project evidence",
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

describe("verification handlers enforce the browser boundary independently of Proxy", () => {
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
