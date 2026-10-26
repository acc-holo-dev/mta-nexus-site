import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";
import { consumeRateLimit } from "@nexus/security";

vi.mock("@nexus/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/security")>()),
  consumeRateLimit: vi.fn(async () => ({
    success: true,
  })),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_claim_ip",
      role: "user",
    })),
  },
}));

vi.mock("../apps/web/src/lib/services/commerce-service", () => ({
  commerceService: {
    claimFreeResource: vi.fn(async () => ({
      entitlement: {
        id: "ent_claim_ip",
        subjectType: "user",
        subjectId: "usr_claim_ip",
        permission: "product.download",
        resourceId: "prd_claim_ip",
        createdAt: new Date(),
      },
      alreadyClaimed: false,
    })),
  },
}));

import { POST } from "../apps/web/src/app/api/resources/claim/route";

const secret =
  "trusted-claim-proxy-secret-0123456789abcdef";

function request(headers: Record<string, string>) {
  return new NextRequest(
    "https://nexus.test/api/resources/claim",
    {
      method: "POST",
      headers: {
        ...browserMutationHeaders(),
        "content-type": "application/json",
        cookie:
          "nexus_session=claim-ip-session",
        ...headers,
      },
      body: JSON.stringify({
        productId: "prd_claim_ip",
      }),
    },
  );
}

describe("resource claim trusted request IP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("ignores spoofed forwarding data without the trusted proxy marker", async () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", secret);

    const response = await POST(
      request({
        "x-forwarded-for": "203.0.113.44",
      }),
    );

    expect(response.status).toBe(201);
    expect(consumeRateLimit).toHaveBeenCalledWith(
      "resourceClaim",
      "unknown",
    );
    expect(
      response.headers.get("x-request-id"),
    ).toMatch(/^[0-9a-f-]{20,}$/u);
  });

  it("uses the trusted proxy address only when the marker matches", async () => {
    vi.stubEnv("TRUSTED_PROXY_SECRET", secret);

    const response = await POST(
      request({
        "x-nexus-proxy-secret": secret,
        "x-real-ip": "198.51.100.25",
      }),
    );

    expect(response.status).toBe(201);
    expect(consumeRateLimit).toHaveBeenCalledWith(
      "resourceClaim",
      "198.51.100.25",
    );
  });
});
