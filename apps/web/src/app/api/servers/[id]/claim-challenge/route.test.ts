import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  authenticated: true,
  rateLimited: false,
  issueError: null as unknown,
}));

const issueChallenge = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.issueError) throw state.issueError;
    return {
      challengeId: "scc_00000000-0000-0000-0000-000000000001",
      token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
      expiresAt: "2026-10-07T00:30:00.000Z",
      expectedEndpoint: { ipAddress: "198.51.100.10", port: 22003 },
    };
  }),
);

vi.mock("../../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () =>
      state.authenticated
        ? {
            id: "usr_claimant",
            username: "claimant",
          }
        : null,
    ),
  },
}));

vi.mock("../../../../../lib/services/server-claim-service", () => ({
  serverClaimService: {
    issueChallenge,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: !state.rateLimited })),
}));

import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { POST } from "./route";

function request() {
  return new NextRequest("https://nexus.test/api/servers/srv_1/claim-challenge", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=test-session",
      "content-type": "application/json",
    },
  });
}

describe("server claim challenge issue HTTP contract", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.authenticated = true;
    state.rateLimited = false;
    state.issueError = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("issues a control token with private cache headers and without digest fields", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "srv_1" }),
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    const body = await response.json();
    expect(body).toMatchObject({
      challenge: {
        challengeId: "scc_00000000-0000-0000-0000-000000000001",
        token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
        expectedEndpoint: { ipAddress: "198.51.100.10", port: 22003 },
      },
    });
    expect(body).not.toHaveProperty("tokenDigest");
    expect(JSON.stringify(body)).not.toContain("tokenDigest");
    expect(issueChallenge).toHaveBeenCalledWith(
      "srv_1",
      expect.objectContaining({ id: "usr_claimant" }),
    );
  });

  it.each(["auth", "rate"] as const)("enforces %s before issuing a challenge", async (boundary) => {
    state.authenticated = boundary !== "auth";
    state.rateLimited = boundary === "rate";
    const response = await POST(request(), {
      params: Promise.resolve({ id: "srv_1" }),
    });
    expect(response.status).toBe(boundary === "auth" ? 401 : 429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(issueChallenge).not.toHaveBeenCalled();
  });

  it("returns 404 for an empty server id before service work", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "" }),
    });
    expect(response.status).toBe(404);
    expect(issueChallenge).not.toHaveBeenCalled();
  });

  it.each(["SERVER_CLAIM_SCOPE_CHANGED", "SERVER_CLAIM_AUTHORITY_CHANGED"] as const)(
    "preserves a stable claim conflict code: %s",
    async (code) => {
      state.issueError = new AppError("Claim changed", 409, code);
      const response = await POST(request(), {
        params: Promise.resolve({ id: "srv_1" }),
      });
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        error: "Claim changed",
        code,
      });
    },
  );

  it("returns a generic failure without leaking persistence detail", async () => {
    state.issueError = new Error("database rejected secret value");
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request(), {
        params: Promise.resolve({ id: "srv_1" }),
      });
      expect(response.status).toBe(500);
      const payload = await response.json();
      expect(payload).toEqual({
        error: "Could not create server control challenge",
      });
      expect(JSON.stringify(payload)).not.toContain("secret value");
      expect(JSON.stringify(payload)).not.toContain("NXCLAIM-");
    } finally {
      error.mockRestore();
    }
  });
});
