import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getClientIp } from "@nexus/security";
import { getTrustedRequestIp } from "../apps/web/src/lib/request-client-ip";

const secret = "trusted-proxy-secret-0123456789abcdef";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("trusted request IP security boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts forwarded client identity only with the exact trusted proxy marker", () => {
    expect(
      getClientIp(
        headers({
          "x-nexus-proxy-secret": secret,
          "x-real-ip": "198.51.100.41",
          "x-forwarded-for": "198.51.100.42, 10.0.0.2",
        }),
        secret,
      ),
    ).toBe("198.51.100.41");

    expect(
      getClientIp(
        headers({
          "x-nexus-proxy-secret": secret,
          "x-real-ip": "not-an-ip",
          "x-forwarded-for": "198.51.100.42, 10.0.0.2",
        }),
        secret,
      ),
    ).toBe("198.51.100.42");
  });

  it("does not trust spoofed forwarding headers with a missing or wrong proxy marker", () => {
    expect(
      getClientIp(
        headers({
          "x-real-ip": "203.0.113.1",
          "x-forwarded-for": "203.0.113.2",
        }),
        secret,
      ),
    ).toBe("unknown");

    expect(
      getClientIp(
        headers({
          "x-nexus-proxy-secret":
            "wrong-proxy-secret-0123456789abcdef",
          "x-real-ip": "203.0.113.3",
        }),
        secret,
      ),
    ).toBe("unknown");
  });

  it("rejects an invalid configured proxy secret instead of weakening trust rules", () => {
    expect(() =>
      getClientIp(
        headers({
          "x-nexus-proxy-secret": "short",
          "x-real-ip": "198.51.100.50",
        }),
        "short",
      ),
    ).toThrow(/Invalid trusted proxy secret/u);
  });

  it("uses one stable local identity outside production when the proxy is absent", () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRUSTED_PROXY_SECRET", "");

    const request = new NextRequest("http://nexus.test/", {
      headers: {
        "x-forwarded-for": "203.0.113.99",
      },
    });

    expect(getTrustedRequestIp(request)).toBe("local-direct");
  });

  it("fails closed in production when the trusted proxy secret is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_SECRET", "");

    const request = new NextRequest("https://nexus.test/", {
      headers: {
        "x-real-ip": "198.51.100.70",
        "x-forwarded-for": "198.51.100.71",
      },
    });

    expect(() => getTrustedRequestIp(request)).toThrow(
      /Trusted proxy secret is unavailable/u,
    );
  });

  it("passes verified production proxy identity through the wrapper", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TRUSTED_PROXY_SECRET", secret);

    const request = new NextRequest("https://nexus.test/", {
      headers: {
        "x-nexus-proxy-secret": secret,
        "x-real-ip": "198.51.100.80",
      },
    });

    expect(getTrustedRequestIp(request)).toBe("198.51.100.80");
  });
});
