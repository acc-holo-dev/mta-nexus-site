import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { consumeRateLimit } from "@nexus/security";
import { GET } from "../apps/web/src/app/api/search/route";

vi.mock("@nexus/security", async (importOriginal) => ({
  ...await importOriginal<typeof import("@nexus/security")>(),
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("../apps/web/src/lib/services/discovery-service", () => ({
  discoveryService: { search: vi.fn(async () => []) },
}));

const secret = "trusted-search-proxy-secret-0123456789abcdef";

describe("public search rate-limit identity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("ignores a spoofed forwarded IP and accepts only the trusted proxy marker", async () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", secret);

    const untrusted = await GET(new NextRequest("https://nexus.test/api/search?q=server", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    }));
    expect(untrusted.status).toBe(200);
    expect(untrusted.headers.get("cache-control")).toContain("public");
    expect(untrusted.headers.get("x-request-id")).toBeNull();
    expect(consumeRateLimit).toHaveBeenCalledWith("search", "unknown");

    vi.mocked(consumeRateLimit).mockClear();
    const trusted = await GET(new NextRequest("https://nexus.test/api/search?q=server", {
      headers: {
        "x-nexus-proxy-secret": secret,
        "x-real-ip": "198.51.100.25",
      },
    }));
    expect(trusted.status).toBe(200);
    expect(trusted.headers.get("x-request-id")).toBeNull();
    expect(consumeRateLimit).toHaveBeenCalledWith("search", "198.51.100.25");
  });
});
