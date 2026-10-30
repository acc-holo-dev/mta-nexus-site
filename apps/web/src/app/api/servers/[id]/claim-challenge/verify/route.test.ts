import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  failVerification: false,
  authenticated: true,
  rateLimited: false,
  verificationError: null as unknown,
}));

const verifyChallenge = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.verificationError) throw state.verificationError;
    if (state.failVerification) {
      throw new Error("verification failed");
    }
    return {
      success: true,
      verificationRequest: {
        id: "ver_1",
        status: "pending",
      },
      proof: {
        method: "mta_master_name_challenge",
        challengeId: "scc_00000000-0000-0000-0000-000000000001",
        sourceFetchedAt: "2026-10-07T00:00:00.000Z",
        verifiedAt: "2026-10-07T00:00:01.000Z",
      },
    };
  }),
);

vi.mock("../../../../../../lib/services/auth-service", () => ({
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

vi.mock("../../../../../../lib/services/server-claim-service", () => ({
  serverClaimService: {
    verifyChallenge,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: !state.rateLimited })),
}));

import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { POST } from "./route";

function request(overrides: { headers?: Record<string, string>; body?: string } = {}) {
  const { headers: headerOverrides, ...rest } = overrides;
  return new NextRequest("https://nexus.test/api/servers/srv_1/claim-challenge/verify", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=test-session",
      ...(headerOverrides ?? { "content-type": "application/json" }),
    },
    body: JSON.stringify({
      challengeId: "scc_00000000-0000-0000-0000-000000000001",
      token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
    }),
    ...rest,
  });
}

describe("server claim verification HTTP", () => {
  beforeEach(() => {
    stubBrowserMutationOrigin();
    vi.clearAllMocks();
    state.failVerification = false;
    state.authenticated = true;
    state.rateLimited = false;
    state.verificationError = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns durable proof without a post-commit moderator callback", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "srv_1" }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      verificationRequest: { id: "ver_1" },
    });
    expect(data).not.toHaveProperty("moderatorNotification");
    expect(verifyChallenge).toHaveBeenCalledOnce();
  });

  it("does not call verification service if proof verification fails", async () => {
    state.failVerification = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request(), {
        params: Promise.resolve({ id: "srv_1" }),
      });
      expect(response.status).toBe(500);
      expect(response.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{20,}$/u);
      expect(verifyChallenge).toHaveBeenCalledOnce();
    } finally {
      error.mockRestore();
    }
  });

  it.each([
    {
      headers: { "content-type": "text/plain" },
      body: "{}",
      status: 415,
      code: "UNSUPPORTED_MEDIA_TYPE",
    },
    { headers: {}, body: "{}", status: 415, code: "UNSUPPORTED_MEDIA_TYPE" },
    {
      headers: { "content-type": "application/json" },
      body: "x".repeat(32769),
      status: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    },
    {
      headers: { "content-type": "application/json", "content-length": "999999" },
      body: "{}",
      status: 413,
      code: "REQUEST_BODY_TOO_LARGE",
    },
    { headers: { "content-type": "application/json" }, body: "not-json", status: 400 },
  ] as Array<{ headers: Record<string, string>; body: string; status: number; code?: string }>)(
    "rejects unreadable or oversized proof before verification: $status $code",
    async ({ headers, body, status, code }) => {
      const response = await POST(request({ headers, body }), {
        params: Promise.resolve({ id: "srv_1" }),
      });
      expect(response.status).toBe(status);
      if (code) expect(await response.json()).toHaveProperty("code", code);
      expect(response.headers.get("Cache-Control")).toBe("private, no-store");
      expect(verifyChallenge).not.toHaveBeenCalled();
    },
  );

  it.each(["auth", "rate"])("enforces %s before parsing proof", async (boundary) => {
    state.authenticated = boundary !== "auth";
    state.rateLimited = boundary === "rate";
    const response = await POST(request({ headers: {}, body: "invalid" }), {
      params: Promise.resolve({ id: "srv_1" }),
    });
    expect(response.status).toBe(boundary === "auth" ? 401 : 429);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(verifyChallenge).not.toHaveBeenCalled();
  });

  it.each(["SERVER_CLAIM_SCOPE_CHANGED", "SERVER_CLAIM_AUTHORITY_CHANGED"])(
    "preserves a stable claim conflict code: %s",
    async (code) => {
      state.verificationError = new AppError("Claim changed", 409, code);
      const response = await POST(request(), { params: Promise.resolve({ id: "srv_1" }) });
      expect(response.status).toBe(409);
      expect(await response.json()).toHaveProperty("code", code);
    },
  );
});
