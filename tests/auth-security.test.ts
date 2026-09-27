import { describe, expect, it } from "vitest";
import {
  generateSessionToken,
  getClientIp,
  MemoryRateLimiter,
} from "@nexus/security";

describe("Authentication security primitives", () => {
  it("creates high-entropy URL-safe session tokens", () => {
    const first = generateSessionToken();
    const second = generateSessionToken();

    expect(first).toMatch(/^ses_[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("normalizes proxy IP headers and rejects arbitrary values", () => {
    const secret = "trusted-proxy-secret-0123456789abcdef";
    expect(
      getClientIp(new Headers({
        "x-nexus-proxy-secret": secret,
        "x-forwarded-for": "203.0.113.10, 10.0.0.2",
      }), secret)
    ).toBe("203.0.113.10");
    expect(getClientIp(new Headers({ "x-real-ip": "not-an-ip" }), secret)).toBe("unknown");
    expect(getClientIp(new Headers({ "x-forwarded-for": "203.0.113.10" }), secret)).toBe("unknown");
  });

  it("enforces limits and bounds memory under rotating keys", async () => {
    const limiter = new MemoryRateLimiter(2, 1);

    expect((await limiter.consume("same", 1, 60)).success).toBe(true);
    expect((await limiter.consume("same", 1, 60)).success).toBe(false);

    await limiter.consume("rotating-1", 1, 60);
    await limiter.consume("rotating-2", 1, 60);
    expect((await limiter.consume("rotating-3", 1, 60)).success).toBe(true);
  });
});
