import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authRegisterApiCopy } from "../../src/features/accounts/auth-register-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    register: mocks.register,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: vi.fn(() => "203.0.113.10"),
}));

import { POST } from "../../src/app/api/auth/register/route";

function request(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/register", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth register API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual rate-limit and validation errors from nexus_locale", async () => {
    mocks.rate.mockResolvedValueOnce({ success: false });
    const rateRu = await POST(
      request("ru", { email: "a@b.c", password: "password1", username: "user" }),
    );
    expect(rateRu.status).toBe(429);
    expect(await rateRu.json()).toMatchObject({ error: authRegisterApiCopy("ru").rate });

    const invalidRu = await POST(request("ru", { email: "bad", password: "" }));
    expect(invalidRu.status).toBe(400);
    expect(await invalidRu.json()).toMatchObject({
      error: authRegisterApiCopy("ru").validationFailed,
    });
    expect(mocks.register).not.toHaveBeenCalled();
  });
});
