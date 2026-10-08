import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: { id: "usr_owner" } as { id: string } | null,
  allowed: true,
}));
const changePassword = vi.hoisted(() =>
  vi.fn(async () => ({
    token: "ses_rotated",
    expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    revokedSessionCount: 2,
  })),
);
const consumeRateLimit = vi.hoisted(() =>
  vi.fn(async () => ({ success: state.allowed })),
);

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => state.user),
    changePassword,
  },
}));
vi.mock("@nexus/security", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@nexus/security")>();
  return { ...actual, consumeRateLimit };
});

import { POST } from "./route";

function request(body: unknown, cookie = "nexus_session=ses_current") {
  return new NextRequest("http://nexus.test/api/auth/password", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(body),
  });
}
const validBody = {
  currentPassword: "Current-password-123!",
  newPassword: "Replacement-password-456!",
};

describe("password change HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.user = { id: "usr_owner" };
    state.allowed = true;
    changePassword.mockResolvedValue({
      token: "ses_rotated",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      revokedSessionCount: 2,
    });
  });

  it("rotates the session cookie without exposing the replacement token in JSON", async () => {
    const response = await POST(request(validBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
    expect(await response.json()).toEqual({ success: true, revokedSessionCount: 2 });

    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("nexus_session=ses_rotated");
    expect(setCookie).toMatch(/HttpOnly/iu);
    expect(setCookie).toMatch(/SameSite=lax/iu);
    expect(setCookie).toMatch(/Path=\//iu);
    expect(changePassword).toHaveBeenCalledWith({
      userId: "usr_owner",
      currentPassword: validBody.currentPassword,
      newPassword: validBody.newPassword,
      currentToken: "ses_current",
    });
    expect(consumeRateLimit).toHaveBeenCalledWith("passwordChange", "usr_owner");
  });

  it("rejects unauthenticated, rate-limited and invalid requests before mutation", async () => {
    state.user = null;
    expect((await POST(request(validBody, ""))).status).toBe(401);
    expect(changePassword).not.toHaveBeenCalled();

    state.user = { id: "usr_owner" };
    state.allowed = false;
    expect((await POST(request(validBody))).status).toBe(429);
    expect(changePassword).not.toHaveBeenCalled();

    state.allowed = true;
    expect((await POST(request({
      currentPassword: "short",
      newPassword: "short",
    }))).status).toBe(400);
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("returns a generic failure without leaking credentials or tokens", async () => {
    changePassword.mockRejectedValueOnce(new Error("database rejected secret value"));
    const response = await POST(request(validBody));
    expect(response.status).toBe(503);
    const payload = await response.json();
    expect(payload).toEqual({
      error: "Could not confirm the password change. Sign in again before retrying.",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("database rejected");
    expect(serialized).not.toContain("ses_rotated");
    expect(serialized).not.toContain(validBody.currentPassword);
    expect(serialized).not.toContain(validBody.newPassword);
  });
});
