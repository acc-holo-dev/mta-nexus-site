import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authPasswordApiCopy } from "../../src/features/accounts/auth-password-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const state = vi.hoisted(() => ({
  user: { id: "usr_password", displayName: "Pass" } as null | {
    id: string;
    displayName: string;
  },
}));

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  changePassword: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
    changePassword: mocks.changePassword,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { POST } from "../../src/app/api/auth/password/route";

function request(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/password", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth password API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    state.user = { id: "usr_password", displayName: "Pass" };
    mocks.getSession.mockImplementation(async () => state.user);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual ACCOUNT_CHANGED from nexus_locale", async () => {
    const en = await POST(
      request("en", {
        expectedActorId: "usr_other",
        currentPassword: "old-password-1",
        newPassword: "new-password-1A",
      }),
    );
    expect(en.status).toBe(409);
    expect(await en.json()).toMatchObject({
      code: "ACCOUNT_CHANGED",
      error: authPasswordApiCopy("en").accountChanged,
    });

    const ru = await POST(
      request("ru", {
        expectedActorId: "usr_other",
        currentPassword: "old-password-1",
        newPassword: "new-password-1A",
      }),
    );
    expect(ru.status).toBe(409);
    expect(await ru.json()).toMatchObject({
      code: "ACCOUNT_CHANGED",
      error: authPasswordApiCopy("ru").accountChanged,
    });
    expect(mocks.changePassword).not.toHaveBeenCalled();
  });

  it("returns bilingual 401 when the session is missing", async () => {
    state.user = null;
    mocks.getSession.mockResolvedValue(null);
    const ru = await POST(
      request("ru", {
        expectedActorId: "usr_password",
        currentPassword: "old-password-1",
        newPassword: "new-password-1A",
      }),
    );
    expect(ru.status).toBe(401);
    expect(await ru.json()).toMatchObject({
      error: authPasswordApiCopy("ru").authenticationRequired,
    });
  });
});
