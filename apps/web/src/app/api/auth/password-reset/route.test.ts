import { UnauthorizedError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const requestPasswordReset = vi.hoisted(() => vi.fn(async () => undefined));
const confirmPasswordReset = vi.hoisted(() => vi.fn(async () => ({ revokedSessionCount: 2 })));
const waitForPasswordResetFloor = vi.hoisted(() => vi.fn(async () => undefined));
const passwordResetTargetMs = vi.hoisted(() => vi.fn(() => 0));

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    requestPasswordReset,
    confirmPasswordReset,
  },
}));
vi.mock("../../../../lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "203.0.113.50",
}));
vi.mock("../../../../lib/account-recovery-request-policy", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../../../../lib/account-recovery-request-policy")>();
  return {
    ...actual,
    waitForPasswordResetFloor,
    passwordResetTargetMs,
  };
});

import { PATCH, POST } from "./route";

function post(body: unknown) {
  return new NextRequest("http://nexus.test/api/auth/password-reset", {
    method: "POST",
    headers: { origin: "http://nexus.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function patch(body: unknown) {
  return new NextRequest("http://nexus.test/api/auth/password-reset", {
    method: "PATCH",
    headers: { origin: "http://nexus.test", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const confirmBody = {
  challengeId: "ach_recovery_fixture",
  token: "A".repeat(43),
  newPassword: "Synthetic-D4-new-password!",
};

describe("password-reset HTTP contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestPasswordReset.mockResolvedValue(undefined);
    confirmPasswordReset.mockResolvedValue({ revokedSessionCount: 2 });
    waitForPasswordResetFloor.mockResolvedValue(undefined);
    passwordResetTargetMs.mockReturnValue(0);
  });

  it("returns a privacy-neutral accepted response for known and unknown addresses", async () => {
    const known = await POST(post({ email: "Owner@Example.Invalid" }));
    expect(known.status).toBe(202);
    expect(known.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await known.json()).toEqual({
      accepted: true,
      message: "If an eligible account uses that email, a password reset link will be sent.",
    });
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "owner@example.invalid",
      ip: "203.0.113.50",
    });
    expect(waitForPasswordResetFloor).toHaveBeenCalled();

    requestPasswordReset.mockClear();
    const missing = await POST(post({ email: "missing-reset@example.invalid" }));
    expect(missing.status).toBe(202);
    expect(await missing.json()).toEqual({
      accepted: true,
      message: "If an eligible account uses that email, a password reset link will be sent.",
    });
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: "missing-reset@example.invalid",
      ip: "203.0.113.50",
    });
  });

  it("rejects invalid request bodies before contacting recovery services", async () => {
    expect((await POST(post({ email: "not-an-email" }))).status).toBe(400);
    expect(requestPasswordReset).not.toHaveBeenCalled();

    expect(
      (await PATCH(patch({ challengeId: "bad", token: "short", newPassword: "x" }))).status,
    ).toBe(400);
    expect(confirmPasswordReset).not.toHaveBeenCalled();
  });

  it("confirms a valid reset without issuing a session cookie or echoing secrets", async () => {
    const response = await PATCH(patch(confirmBody));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    const payload = await response.json();
    expect(payload).toEqual({ success: true });
    expect(confirmPasswordReset).toHaveBeenCalledWith({
      ...confirmBody,
      ip: "203.0.113.50",
    });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(confirmBody.token);
    expect(serialized).not.toContain(confirmBody.newPassword);
    expect(serialized).not.toContain("revokedSessionCount");
  });

  it("maps invalid proofs to a generic client error without leaking tokens", async () => {
    confirmPasswordReset.mockRejectedValueOnce(
      new UnauthorizedError("Invalid or expired password reset proof with token detail"),
    );
    const response = await PATCH(patch(confirmBody));
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload).toEqual({ error: "Invalid or expired password reset" });
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain(confirmBody.token);
    expect(serialized).not.toContain(confirmBody.newPassword);
    expect(serialized).not.toContain("token detail");
  });

  it("returns generic failures without leaking credentials, tokens or persistence detail", async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error("cipher key secret-value unavailable"));
    const requestFailure = await POST(post({ email: "owner@example.invalid" }));
    expect(requestFailure.status).toBe(503);
    const requestPayload = await requestFailure.json();
    expect(requestPayload).toEqual({
      error: "Password reset is temporarily unavailable. Please try again later.",
    });
    expect(JSON.stringify(requestPayload)).not.toContain("secret-value");

    confirmPasswordReset.mockRejectedValueOnce(new Error("database rejected secret value"));
    const confirmFailure = await PATCH(patch(confirmBody));
    expect(confirmFailure.status).toBe(503);
    const confirmPayload = await confirmFailure.json();
    expect(confirmPayload).toEqual({
      error: "Could not reset the password. Request a new link and try again.",
    });
    const serialized = JSON.stringify(confirmPayload);
    expect(serialized).not.toContain("database rejected");
    expect(serialized).not.toContain(confirmBody.token);
    expect(serialized).not.toContain(confirmBody.newPassword);
  });
});
