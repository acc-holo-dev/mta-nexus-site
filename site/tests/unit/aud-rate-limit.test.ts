import { createLicenseRuntimeToken, getRateLimitPolicy, MemoryRateLimiter } from "@nexus/security";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  ip: "unknown",
  productReviews: vi.fn(async () => ({ reviews: [], page: 1 })),
  qaPage: vi.fn(async () => ({ threads: [], page: 1 })),
  qaThread: vi.fn(async () => ({ thread: { id: "rqt_a" } })),
  serverReviews: vi.fn(async () => ({ reviews: [], total: 0, page: 1 })),
  verify: vi.fn(async () => ({ valid: true, licenseId: "lic_a" })),
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: () => state.ip,
}));
vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: { getSession: async () => null },
}));
vi.mock("../../src/lib/services/resources/resource-review-service", () => ({
  resourceReviewService: { publicPage: state.productReviews },
}));
vi.mock("../../src/lib/services/resources/resource-qa-service", () => ({
  resourceQaService: { publicPage: state.qaPage, threadDetail: state.qaThread },
}));
vi.mock("../../src/lib/services/servers/server-review-service", () => ({
  serverReviewService: { publicPage: state.serverReviews },
}));
vi.mock("@nexus/db", () => ({
  licenseControlsRepository: { verify: state.verify },
}));

import { POST as licenseCheck } from "../../src/app/api/licenses/check/route";
import { GET as productQaThread } from "../../src/app/api/products/[id]/qa/[threadId]/route";
import { GET as productQa } from "../../src/app/api/products/[id]/qa/route";
import { GET as productReviews } from "../../src/app/api/products/[id]/reviews/route";
import { GET as serverReviews } from "../../src/app/api/servers/[id]/reviews/route";

const productContext = { params: Promise.resolve({ id: "prd_a" }) };
const threadContext = { params: Promise.resolve({ id: "prd_a", threadId: "rqt_a" }) };
const serverContext = { params: Promise.resolve({ id: "srv_a" }) };
const verifiedIp = "203.0.113.10";

function get(path: string) {
  return new NextRequest(`https://nexus.test${path}`);
}

function licenseRequest() {
  const token = createLicenseRuntimeToken();
  return new NextRequest("https://nexus.test/api/licenses/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token.value}`,
    },
    body: JSON.stringify({ serverId: "srv_a" }),
  });
}

describe("AUD-04 live rate-limit buckets", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps a denied key after maxKeys other keys arrive before resetAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const maxKeys = 5;
    const limiter = new MemoryRateLimiter(maxKeys, 1_000_000);
    const opened = await limiter.consume("login", 1, 300);
    expect(opened.success).toBe(true);
    const denied = await limiter.consume("login", 1, 300);
    expect(denied.success).toBe(false);

    for (let index = 0; index < maxKeys; index += 1) {
      const admitted = await limiter.consume(`other-${index}`, 1, 300);
      expect(admitted.success).toBe(true);
    }

    const again = await limiter.consume("login", 1, 300);
    expect(again.success).toBe(false);
    expect(again.resetAt).toBe(denied.resetAt);

    vi.setSystemTime(denied.resetAt);
    const reopened = await limiter.consume("login", 1, 300);
    expect(reopened.success).toBe(true);
    expect(reopened.remaining).toBe(0);
  });

  it("drops an expired oldest key and keeps a newer blocked bucket", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));
    const limiter = new MemoryRateLimiter(2, 1_000_000);
    await limiter.consume("stale", 1, 5);
    expect((await limiter.consume("stale", 1, 5)).success).toBe(false);
    const live = await limiter.consume("live", 1, 300);
    expect((await limiter.consume("live", 1, 300)).success).toBe(false);

    vi.setSystemTime(new Date("2026-06-01T00:00:06.000Z"));
    for (let index = 0; index < 2; index += 1) {
      expect((await limiter.consume(`fresh-${index}`, 1, 300)).success).toBe(true);
    }
    const stillBlocked = await limiter.consume("live", 1, 300);
    expect(stillBlocked.success).toBe(false);
    expect(stillBlocked.resetAt).toBe(live.resetAt);
    expect((await limiter.consume("stale", 1, 5)).success).toBe(true);
  });
});

describe("AUD-44 unknown client addresses", () => {
  beforeEach(() => {
    state.ip = "unknown";
    state.productReviews.mockClear();
    state.qaPage.mockClear();
    state.qaThread.mockClear();
    state.serverReviews.mockClear();
    state.verify.mockClear();
  });

  it("counts unknown product-review reads and returns 429 when exhausted", async () => {
    const { limit } = getRateLimitPolicy("resourceInspection");
    for (let index = 0; index < limit; index += 1) {
      const response = await productReviews(get("/api/products/prd_a/reviews"), productContext);
      expect(response.status).toBe(200);
    }
    expect(state.productReviews).toHaveBeenCalledTimes(limit);
    const blocked = await productReviews(get("/api/products/prd_a/reviews"), productContext);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    expect(state.productReviews).toHaveBeenCalledTimes(limit);

    state.ip = verifiedIp;
    const allowed = await productReviews(get("/api/products/prd_a/reviews"), productContext);
    expect(allowed.status).toBe(200);
    expect(state.productReviews).toHaveBeenCalledTimes(limit + 1);
  });

  it("counts unknown Q&A list and thread reads in one bucket", async () => {
    const { limit } = getRateLimitPolicy("resourceInspection");
    for (let index = 0; index < limit - 1; index += 1) {
      const response = await productQa(get("/api/products/prd_a/qa"), productContext);
      expect(response.status).toBe(200);
    }
    const thread = await productQaThread(get("/api/products/prd_a/qa/rqt_a"), threadContext);
    expect(thread.status).toBe(200);
    const blockedList = await productQa(get("/api/products/prd_a/qa"), productContext);
    const blockedThread = await productQaThread(get("/api/products/prd_a/qa/rqt_a"), threadContext);
    expect(blockedList.status).toBe(429);
    expect(blockedThread.status).toBe(429);
    expect(await blockedList.json()).toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    expect(await blockedThread.json()).toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    expect(state.qaPage).toHaveBeenCalledTimes(limit - 1);
    expect(state.qaThread).toHaveBeenCalledTimes(1);

    state.ip = verifiedIp;
    expect((await productQa(get("/api/products/prd_a/qa"), productContext)).status).toBe(200);
    expect((await productQaThread(get("/api/products/prd_a/qa/rqt_a"), threadContext)).status).toBe(
      200,
    );
  });

  it("counts unknown server-review reads and returns 429 when exhausted", async () => {
    const { limit } = getRateLimitPolicy("resourceInspection");
    for (let index = 0; index < limit; index += 1) {
      const response = await serverReviews(get("/api/servers/srv_a/reviews"), serverContext);
      expect(response.status).toBe(200);
    }
    const blocked = await serverReviews(get("/api/servers/srv_a/reviews"), serverContext);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ code: "RATE_LIMIT_EXCEEDED" });
    expect(state.serverReviews).toHaveBeenCalledTimes(limit);

    state.ip = verifiedIp;
    expect((await serverReviews(get("/api/servers/srv_a/reviews"), serverContext)).status).toBe(
      200,
    );
  });

  it("counts the license IP bucket for an unknown address", async () => {
    const { limit } = getRateLimitPolicy("licenseCheck");
    for (let index = 0; index < limit; index += 1) {
      const response = await licenseCheck(licenseRequest());
      expect(response.status).toBe(200);
    }
    expect(state.verify).toHaveBeenCalledTimes(limit);
    const blocked = await licenseCheck(licenseRequest());
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ valid: false, code: "RATE_LIMIT_EXCEEDED" });
    expect(state.verify).toHaveBeenCalledTimes(limit);

    state.ip = verifiedIp;
    const allowed = await licenseCheck(licenseRequest());
    expect(allowed.status).toBe(200);
    expect(state.verify).toHaveBeenCalledTimes(limit + 1);
  }, 20_000);
});
