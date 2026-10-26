import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => null),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "unknown",
}));
vi.mock("@nexus/security", () => ({
  can: () => false,
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: () => "aud_a",
  getClientIp: () => "unknown",
}));
vi.mock("../apps/web/src/lib/services/resource-review-service", () => ({
  resourceReviewService: {
    command: vi.fn(),
    report: vi.fn(),
    publicPage: vi.fn(),
    ownDetail: vi.fn(),
  },
}));

import { POST as createReview } from "../apps/web/src/app/api/products/[id]/reviews/route";
import { POST as reportReview } from "../apps/web/src/app/api/products/[id]/reviews/[reviewId]/report/route";
import { POST as editReview } from "../apps/web/src/app/api/library/review/[id]/route";

const context = { params: Promise.resolve({ id: "prd_a", reviewId: "cmt_a" }) };
const mutations = [
  ["review create", createReview],
  ["review report", reportReview],
  ["review edit", editReview],
] as const;

function request(headers: Record<string, string> = {}) {
  return new NextRequest("https://nexus.test/api/products/prd_a/reviews", {
    method: "POST",
    headers: {
      cookie: "nexus_session=reader",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ rating: 5, text: "Useful resource" }),
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

describe("resource review handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session or body reads",
    async (_name, handler) => {
      const input = request();
      const response = await handler(input, context);
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
      const response = await handler(input, context);
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
        context,
      );
      expect(authService.getSession).toHaveBeenCalledOnce();
      const body = await response.json();
      expect(body.code).not.toBe("CSRF_REJECTED");
    },
  );
});
