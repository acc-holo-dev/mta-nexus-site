import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../../tests/browser-mutation-headers";

const authState = vi.hoisted(() => ({
  user: null as null | {
    id: string;
    email: string;
    username: string;
    displayName: string;
    role: "user";
  },
}));

const claimState = vi.hoisted(() => ({
  alreadyClaimed: false,
}));

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => authState.user),
  },
}));

vi.mock("../../../../lib/services/commerce-service", () => ({
  commerceService: {
    claimFreeResource: vi.fn(async () => ({
      entitlement: {
        id: "ent_http",
        subjectType: "user",
        subjectId: "usr_http",
        permission: "product.download",
        resourceId: "prd_http",
        createdAt: new Date("2026-09-25T00:00:00.000Z"),
      },
      alreadyClaimed: claimState.alreadyClaimed,
    })),
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({
    success: true,
    remaining: 1,
    resetAt: new Date(Date.now() + 60_000),
  })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new NextRequest("http://nexus.test/api/resources/claim", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("free resource claim HTTP contract", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    authState.user = {
      id: "usr_http",
      email: "http@nexus.test",
      username: "http_claim",
      displayName: "HTTP Claim User",
      role: "user",
    };
    claimState.alreadyClaimed = false;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 201 for the first successful claim", async () => {
    const response = await POST(request({ productId: "prd_http" }));

    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(await response.json()).toMatchObject({
      alreadyClaimed: false,
      entitlement: {
        resourceId: "prd_http",
        permission: "product.download",
      },
    });
  });

  it("returns 200 for an idempotent retry", async () => {
    claimState.alreadyClaimed = true;

    const response = await POST(request({ productId: "prd_http" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(await response.json()).toMatchObject({
      alreadyClaimed: true,
      entitlement: {
        resourceId: "prd_http",
      },
    });
  });

  it("returns 401 for an anonymous claim", async () => {
    authState.user = null;

    const response = await POST(request({ productId: "prd_http" }));

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    expect(await response.json()).toEqual({
      error: "Authentication required",
    });
  });

  it("returns 400 for an invalid body before calling the claim service", async () => {
    const response = await POST(request({ productId: "" }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid resource claim",
    });
  });
});
