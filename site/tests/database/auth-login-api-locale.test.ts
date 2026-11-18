import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authLoginApiCopy } from "../../src/features/accounts/auth-login-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    login: mocks.login,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: vi.fn(() => "203.0.113.10"),
}));

import { POST } from "../../src/app/api/auth/login/route";

function request(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/login", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth login API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual rate-limit and validation errors from nexus_locale", async () => {
    mocks.rate.mockResolvedValueOnce({ success: false });
    const rateRu = await POST(request("ru", { email: "a@b.c", password: "secret" }));
    expect(rateRu.status).toBe(429);
    expect(await rateRu.json()).toMatchObject({ error: authLoginApiCopy("ru").rate });

    const invalidRu = await POST(request("ru", { email: "not-an-email", password: "" }));
    expect(invalidRu.status).toBe(400);
    expect(await invalidRu.json()).toMatchObject({
      error: authLoginApiCopy("ru").invalidCredentials,
    });
    expect(mocks.login).not.toHaveBeenCalled();
  });
});
