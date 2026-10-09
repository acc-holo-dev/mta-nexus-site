import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { parseSessionRevocation } from "../../../../lib/session-revocation";

const state = vi.hoisted(() => ({
  user: { id: "usr_owner" } as { id: string } | null,
  currentSessionId: "ses_current",
  owned: true,
  revokedCount: 2,
  allowed: true,
}));
const revokeSession = vi.hoisted(() => vi.fn(async () => state.owned));
const revokeOthers = vi.hoisted(() => vi.fn(async () => state.revokedCount));
const listSessions = vi.hoisted(() => vi.fn(async () => [
  {
    id: "ses_current",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    ipAddress: "203.0.113.10",
    userAgent: "Current browser",
    createdAt: new Date("2029-01-01T00:00:00.000Z"),
  },
  {
    id: "ses_other",
    expiresAt: new Date("2030-01-02T00:00:00.000Z"),
    ipAddress: undefined,
    userAgent: "Other browser",
    createdAt: new Date("2029-01-02T00:00:00.000Z"),
  },
]));

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
    getSessionIdentity: vi.fn(async () => state.user
      ? { user: state.user, sessionId: state.currentSessionId } : null),
    getCurrentSessionId: vi.fn(async () => state.currentSessionId),
    revokeSession,
    revokeOtherSessions: revokeOthers,
    listSessions,
  },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
vi.mock("@nexus/domain", () => ({
  AppError: class AppError extends Error {},
}));

import { DELETE, GET } from "./route";
import { authService } from "../../../../lib/services/auth-service";

function listRequest() {
  return new NextRequest("http://nexus.test/api/auth/sessions", {
    headers: { cookie: "nexus_session=token_owner" },
  });
}

function request(body: unknown) {
  return new NextRequest("http://nexus.test/api/auth/sessions", {
    method: "DELETE",
    headers: { "content-type": "application/json", cookie: "nexus_session=token_owner" },
    body: JSON.stringify(body),
  });
}

describe("session listing HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "usr_owner" };
    state.currentSessionId = "ses_current";
  });

  it("returns private active-session metadata with the current session marked", async () => {
    const response = await GET(listRequest());
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );

    const body = await response.json();
    expect(body.sessions).toEqual([
      {
        id: "ses_current",
        expiresAt: "2030-01-01T00:00:00.000Z",
        ipAddress: "203.0.113.10",
        userAgent: "Current browser",
        createdAt: "2029-01-01T00:00:00.000Z",
        isCurrent: true,
      },
      {
        id: "ses_other",
        expiresAt: "2030-01-02T00:00:00.000Z",
        userAgent: "Other browser",
        createdAt: "2029-01-02T00:00:00.000Z",
        isCurrent: false,
      },
    ]);
    for (const session of body.sessions) {
      expect(session).not.toHaveProperty("token");
      expect(session).not.toHaveProperty("userId");
    }
    expect(listSessions).toHaveBeenCalledWith("usr_owner");
    expect(authService.getSessionIdentity).toHaveBeenCalledOnce();
    expect(authService.getSessionIdentity).toHaveBeenCalledWith("token_owner");
    expect(authService.getSession).not.toHaveBeenCalled();
    expect(authService.getCurrentSessionId).not.toHaveBeenCalled();
  });

  it("does not expose session metadata without authentication", async () => {
    state.user = null;
    const response = await GET(listRequest());
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(listSessions).not.toHaveBeenCalled();
  });
});

describe("session revocation command matrix", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "usr_owner" };
    state.currentSessionId = "ses_current";
    state.owned = true;
    state.revokedCount = 2;
    state.allowed = true;
  });

  it.each([
    null, [], {}, { allOther: false }, { allOther: true, sessionId: "ses_other" },
    { sessionId: "" }, { sessionId: " ".repeat(4) },
    { sessionId: "s".repeat(129) }, { sessionId: 42 },
    { sessionId: "ses_other", extra: true }, JSON.parse('{"__proto__":{}}'),
  ])("rejects ambiguous or invalid command %j without revoking anything", async (body) => {
    expect(parseSessionRevocation(body)).toBeNull();
    const response = await DELETE(request(body));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("X-Request-Id")).toMatch(
      /^[0-9a-f-]{20,}$/u,
    );
    expect(revokeSession).not.toHaveBeenCalled();
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it("returns the exact owned session ID after single revocation", async () => {
    const response = await DELETE(request({ sessionId: "ses_other" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true, scope: "single", sessionId: "ses_other",
    });
    expect(revokeSession).toHaveBeenCalledWith("usr_owner", "ses_other", "token_owner");
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it("blocks current and unowned sessions", async () => {
    const current = await DELETE(request({ sessionId: "ses_current" }));
    expect(current.status).toBe(409);
    expect(revokeSession).not.toHaveBeenCalled();
    expect(authService.getSessionIdentity).toHaveBeenCalledOnce();
    expect(authService.getCurrentSessionId).not.toHaveBeenCalled();

    state.owned = false;
    const unowned = await DELETE(request({ sessionId: "ses_foreign" }));
    expect(unowned.status).toBe(404);
    expect(revokeOthers).not.toHaveBeenCalled();
  });

  it("revokes only other sessions when requested explicitly", async () => {
    const response = await DELETE(request({ allOther: true }));
    expect(await response.json()).toEqual({
      success: true, scope: "others", revokedCount: 2,
    });
    expect(revokeOthers).toHaveBeenCalledWith("usr_owner", "token_owner");
    expect(revokeSession).not.toHaveBeenCalled();
  });

  it("does not revoke when unauthenticated or rate limited", async () => {
    state.user = null;
    expect((await DELETE(request({ allOther: true }))).status).toBe(401);
    state.user = { id: "usr_owner" };
    state.allowed = false;
    expect((await DELETE(request({ allOther: true }))).status).toBe(429);
    expect(revokeOthers).not.toHaveBeenCalled();
  });
});
