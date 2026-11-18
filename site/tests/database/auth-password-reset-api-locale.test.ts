import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPasswordResetApiCopy } from "../../src/features/accounts/auth-password-reset-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    requestPasswordReset: mocks.requestPasswordReset,
    confirmPasswordReset: mocks.confirmPasswordReset,
  },
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: vi.fn(() => "203.0.113.10"),
}));

vi.mock("../../src/features/accounts/account-recovery-request-policy", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("../../src/features/accounts/account-recovery-request-policy")
    >();
  return {
    ...actual,
    waitForPasswordResetFloor: vi.fn(async () => undefined),
    passwordResetTargetMs: () => 0,
  };
});

import { PATCH, POST } from "../../src/app/api/auth/password-reset/route";

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/password-reset", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function patchRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/password-reset", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth password-reset API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.requestPasswordReset.mockResolvedValue(undefined);
    mocks.confirmPasswordReset.mockResolvedValue(undefined);
  });

  it("returns bilingual POST validation and PATCH expired errors from nexus_locale", async () => {
    const invalidEmail = await POST(postRequest("ru", { email: "not-an-email" }));
    expect(invalidEmail.status).toBe(400);
    expect(await invalidEmail.json()).toMatchObject({
      error: authPasswordResetApiCopy("ru").invalidEmail,
    });

    const expired = await PATCH(patchRequest("ru", { token: "tok", newPassword: "short" }));
    expect(expired.status).toBe(400);
    expect(await expired.json()).toMatchObject({
      error: authPasswordResetApiCopy("ru").invalidOrExpired,
    });
    expect(mocks.confirmPasswordReset).not.toHaveBeenCalled();
  });
});
