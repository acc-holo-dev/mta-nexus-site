import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authEmailVerificationApiCopy } from "../../src/features/accounts/auth-email-verification-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getRecoveryEmailStatus: vi.fn(),
  requestRecoveryEmailVerification: vi.fn(),
  confirmRecoveryEmailVerification: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
    getRecoveryEmailStatus: mocks.getRecoveryEmailStatus,
    requestRecoveryEmailVerification: mocks.requestRecoveryEmailVerification,
    confirmRecoveryEmailVerification: mocks.confirmRecoveryEmailVerification,
  },
}));

import { GET, PATCH, POST } from "../../src/app/api/auth/email-verification/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/auth/email-verification", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/email-verification", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function patchRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/email-verification", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth email-verification API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_ev" });
    mocks.getRecoveryEmailStatus.mockResolvedValue({
      email: "a@b.c",
      verified: false,
      verifiedAt: null,
      eligible: true,
    });
  });

  it("returns bilingual GET 401 from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const ru = await GET(getRequest("ru"));
    expect(ru.status).toBe(401);
    expect(await ru.json()).toMatchObject({
      error: authEmailVerificationApiCopy("ru").authenticationRequired,
    });
  });

  it("returns bilingual POST ACTOR_CHANGED and PATCH invalid from nexus_locale", async () => {
    const changed = await POST(
      postRequest("ru", { currentPassword: "password1", expectedActorId: "usr_other" }),
    );
    expect(changed.status).toBe(409);
    expect(await changed.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: authEmailVerificationApiCopy("ru").accountChanged,
    });
    expect(mocks.requestRecoveryEmailVerification).not.toHaveBeenCalled();

    const invalid = await PATCH(patchRequest("en", { challengeId: "", token: "" }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: authEmailVerificationApiCopy("en").invalidOrExpired,
    });
    expect(mocks.confirmRecoveryEmailVerification).not.toHaveBeenCalled();
  });
});
