import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

vi.mock("@nexus/ui", () => ({
  Button: () => null,
  ErrorState: () => null,
  Input: () => null,
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
}));

vi.mock("../../src/features/shell/request-client-ip", () => ({
  getTrustedRequestIp: vi.fn(() => "203.0.113.10"),
}));

import { POST as login } from "../../src/app/api/auth/login/route";
import { POST as register } from "../../src/app/api/auth/register/route";
import { authLoginApiCopy } from "../../src/features/accounts/auth-login-api-copy";
import { authRegisterApiCopy } from "../../src/features/accounts/auth-register-api-copy";
import { authFormResponseError } from "../../src/features/accounts/components/auth-form";
import {
  authEntryHref,
  parseAuthReturnPath,
  resolveAuthReturnPath,
} from "../../src/features/shell/auth-return";
import { getDictionary } from "../../src/lib/i18n";
import { authService } from "../../src/lib/services/accounts/auth-service";

const protocolRelative = [
  "/..//evil.com",
  "/%2e%2e//evil.com",
  "/.%2e//evil.com",
  "/foo/..//evil.com/phish?x=1",
] as const;

describe("AUD-34 auth return paths", () => {
  it("rejects dot-segment protocol-relative targets and resolves them to workspace", () => {
    for (const value of protocolRelative) {
      expect(parseAuthReturnPath(value)).toBeNull();
      expect(resolveAuthReturnPath(value)).toBe("/workspace");
    }
    expect(authEntryHref("login", "/..//evil.com")).toBe("/auth/login");
  });

  it("keeps direct external targets rejected and same-app paths intact", () => {
    expect(parseAuthReturnPath("//evil.com")).toBeNull();
    expect(parseAuthReturnPath("https://evil.com")).toBeNull();
    expect(resolveAuthReturnPath("//evil.com")).toBe("/workspace");
    expect(resolveAuthReturnPath("https://evil.com")).toBe("/workspace");
    expect(parseAuthReturnPath("/workspace")).toBe("/workspace");
    expect(parseAuthReturnPath("/foo/../workspace")).toBe("/workspace");
    expect(resolveAuthReturnPath("/acquire?productId=prd_a")).toBe("/acquire?productId=prd_a");
  });
});

function authRequest(path: string, locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest(`https://nexus.test${path}`, {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("AUD-38 auth validation copy", () => {
  const password = "Sup3rSecret-password";
  const zodPayload = {
    code: "VALIDATION_ERROR",
    details: {
      email: { _errors: ["Invalid email address"] },
      password: { _errors: [password, "Password is required"] },
      displayName: { _errors: ["Too small: expected string to have >=2 characters"] },
    },
  };

  it("maps Russian login and registration failures to locale copy without Zod text or the password", () => {
    const login = authFormResponseError(
      zodPayload,
      "ru",
      false,
      getDictionary("ru").auth.genericError,
    );
    const registration = authFormResponseError(
      zodPayload,
      "ru",
      true,
      getDictionary("ru").auth.genericError,
    );

    expect(login).toBe(authLoginApiCopy("ru").invalidCredentials);
    expect(registration).toBe(authRegisterApiCopy("ru").validationFailed);
    expect(login).not.toContain("Invalid email address");
    expect(registration).not.toContain("Too small: expected string to have >=2 characters");
    expect(login).not.toContain(password);
    expect(registration).not.toContain(password);
    expect(authFormResponseError({ code: "UNAUTHORIZED" }, "ru", false, "fallback")).toBe(
      authLoginApiCopy("ru").unauthorized,
    );
  });

  it("maps English validation to the English copy instead of raw Zod messages", () => {
    expect(authFormResponseError(zodPayload, "en", false, "fallback")).toBe(
      authLoginApiCopy("en").invalidCredentials,
    );
    expect(authFormResponseError(zodPayload, "en", true, "fallback")).toBe(
      authRegisterApiCopy("en").validationFailed,
    );
  });

  it("returns locale copy from login and registration without Zod text or the password", async () => {
    stubBrowserMutationOrigin();
    const loginBody = await (
      await login(authRequest("/api/auth/login", "ru", { email: "a@b", password }))
    ).json();
    const registerBody = await (
      await register(
        authRequest("/api/auth/register", "ru", {
          email: "user@example.com",
          username: "user_ok",
          password,
          displayName: "a",
        }),
      )
    ).json();

    expect(loginBody).toEqual({
      error: authLoginApiCopy("ru").invalidCredentials,
      code: "VALIDATION_ERROR",
    });
    expect(registerBody).toEqual({
      error: authRegisterApiCopy("ru").validationFailed,
      code: "VALIDATION_ERROR",
    });
    for (const body of [loginBody, registerBody]) {
      const encoded = JSON.stringify(body);
      expect(encoded).not.toContain("Invalid email address");
      expect(encoded).not.toContain("Too small: expected string to have >=2 characters");
      expect(encoded).not.toContain(password);
    }
    expect(authService.login).not.toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
  });
});
