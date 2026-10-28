import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: (prefix: string) => `${prefix}_${"a".repeat(24)}`,
}));
vi.mock("@nexus/db", () => ({
  supportCaseRepository: {
    pageByRequester: vi.fn(),
    pageStaff: vi.fn(),
    findById: vi.fn(),
    authorizedThread: vi.fn(),
    createIdempotentCase: vi.fn(),
    addIdempotentMessage: vi.fn(),
    findMutationReplay: vi.fn(),
    updateStatus: vi.fn(),
  },
  userRepository: { listModeratorIds: vi.fn() },
}));
vi.mock("../apps/web/src/lib/services/notification-dispatch-service", () => ({
  dispatchNotificationsBestEffort: vi.fn(),
}));

import { POST as createCase } from "../apps/web/src/app/api/support/route";
import {
  PATCH as updateCase,
  POST as addMessage,
} from "../apps/web/src/app/api/support/[id]/route";

const caseId = `sup_${"a".repeat(24)}`;
const context = { params: Promise.resolve({ id: caseId }) };
const mutations = [
  ["support case create", "POST", createCase],
  ["support reply", "POST", addMessage],
  ["support status update", "PATCH", updateCase],
] as const;

function request(method: string, headers: Record<string, string> = {}) {
  return new NextRequest(`https://nexus.test/api/support/${caseId}`, {
    method,
    headers: {
      cookie: "nexus_session=member",
      "content-type": "application/json",
      "idempotency-key": "12345678-1234-4234-8234-123456789abc",
      ...headers,
    },
    body: JSON.stringify({
      category: "account",
      subject: "Account help",
      message: "Please restore access.",
      status: "resolved",
      expectedStatus: "open",
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

describe("support case handlers enforce the browser boundary independently of Proxy", () => {
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
