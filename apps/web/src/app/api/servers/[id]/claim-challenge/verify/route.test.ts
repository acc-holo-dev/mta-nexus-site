import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  afterCallbacks: [] as Array<() => unknown | Promise<unknown>>,
  failVerification: false,
}));

const afterMock = vi.hoisted(() =>
  vi.fn((callback: () => unknown | Promise<unknown>) => {
    state.afterCallbacks.push(callback);
  }),
);
const verifyChallenge = vi.hoisted(() =>
  vi.fn(async () => {
    if (state.failVerification) {
      throw new Error("verification failed");
    }
    return {
      success: true,
      moderatorNotification: {
        serverName: "Nexus Racing",
      },
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
const notifyModerators = vi.hoisted(() => vi.fn(async () => undefined));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>(
    "next/server",
  );
  return {
    ...actual,
    after: afterMock,
  };
});

vi.mock("../../../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({
      id: "usr_claimant",
      username: "claimant",
    })),
  },
}));

vi.mock(
  "../../../../../../lib/services/server-claim-service",
  () => ({
    serverClaimService: {
      verifyChallenge,
    },
    notifyModeratorsOfServerClaim: notifyModerators,
  }),
);

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

function request() {
  return new NextRequest(
    "https://nexus.test/api/servers/srv_1/claim-challenge/verify",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "nexus_session=test-session",
      },
      body: JSON.stringify({
        challengeId:
          "scc_00000000-0000-0000-0000-000000000001",
        token: "NXCLAIM-ABCDEF0123456789ABCDEF01",
      }),
    },
  );
}

describe("server claim moderator notification side effects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.afterCallbacks.length = 0;
    state.failVerification = false;
  });

  it("returns durable proof before scheduling moderator inbox/push delivery", async () => {
    const response = await POST(request(), {
      params: Promise.resolve({ id: "srv_1" }),
    });

    expect(response.status).toBe(201);
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    const data = await response.json();
    expect(data).toMatchObject({
      success: true,
      verificationRequest: { id: "ver_1" },
    });
    expect(data).not.toHaveProperty("moderatorNotification");
    expect(afterMock).toHaveBeenCalledOnce();
    expect(notifyModerators).not.toHaveBeenCalled();

    await state.afterCallbacks[0]?.();

    expect(notifyModerators).toHaveBeenCalledWith("Nexus Racing");
  });

  it("does not schedule moderator work if proof verification fails", async () => {
    state.failVerification = true;
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request(), {
        params: Promise.resolve({ id: "srv_1" }),
      });
      expect(response.status).toBe(500);
      expect(response.headers.get("X-Request-Id")).toMatch(
        /^[0-9a-f-]{20,}$/u,
      );
      expect(afterMock).not.toHaveBeenCalled();
      expect(notifyModerators).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });
});
