import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ id: "usr_owner" })),
  getSessionIdentity: vi.fn(async () => ({ user: { id: "usr_owner" }, sessionId: "ses_current" })),
  login: vi.fn(async () => ({ user: { id: "usr_owner" }, token: "ses_login" })),
  register: vi.fn(async () => ({ user: { id: "usr_owner" }, token: "ses_registered" })),
  logout: vi.fn(async () => undefined),
  changePassword: vi.fn(),
  switchContext: vi.fn(),
  revokeSession: vi.fn(),
  revokeOtherSessions: vi.fn(),
  requestRecoveryEmailVerification: vi.fn(),
  confirmRecoveryEmailVerification: vi.fn(),
  requestPasswordReset: vi.fn(),
  confirmPasswordReset: vi.fn(),
}));
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => ({ success: true })));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({ consumeRateLimit }));
vi.mock("@nexus/db", () => ({ organizationRepository: {} }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => "unknown" }));

import { POST as login } from "../apps/web/src/app/api/auth/login/route";
import { POST as register } from "../apps/web/src/app/api/auth/register/route";
import { DELETE as logout } from "../apps/web/src/app/api/auth/session/route";
import { DELETE as revoke } from "../apps/web/src/app/api/auth/sessions/route";
import { POST as password } from "../apps/web/src/app/api/auth/password/route";
import { POST as context } from "../apps/web/src/app/api/auth/context/route";
import {
  POST as emailRequest,
  PATCH as emailConfirm,
} from "../apps/web/src/app/api/auth/email-verification/route";
import {
  POST as resetRequest,
  PATCH as resetConfirm,
} from "../apps/web/src/app/api/auth/password-reset/route";
import { proxy } from "../apps/web/src/proxy";

const mutations = [
  ["login", "POST", login],
  ["register", "POST", register],
  ["session", "DELETE", logout],
  ["sessions", "DELETE", revoke],
  ["password", "POST", password],
  ["context", "POST", context],
  ["email-verification", "POST", emailRequest],
  ["email-verification", "PATCH", emailConfirm],
  ["password-reset", "POST", resetRequest],
  ["password-reset", "PATCH", resetConfirm],
] as const;

function request(
  path: string,
  method: string,
  origin: string,
  body = "{}",
  contentType = "application/json",
) {
  return new NextRequest(`http://internal-app:3000/api/auth/${path}`, {
    method,
    headers: { origin, "content-type": contentType, cookie: "nexus_session=current" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("auth handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects cross-origin %s %s before body/session/rate-limit work",
    async (path, method, handler) => {
      const input = request(path, method, "https://evil.test");
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(input.bodyUsed).toBe(false);
      for (const operation of Object.values(authService)) expect(operation).not.toHaveBeenCalled();
      expect(consumeRateLimit).not.toHaveBeenCalled();
    },
  );

  it("rejects login CSRF without a pre-existing session", async () => {
    const input = request("login", "POST", "https://evil.test");
    input.headers.delete("cookie");
    expect((await login(input)).status).toBe(403);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it("issues a secure host-only cookie for a valid same-origin login", async () => {
    const response = await login(
      request(
        "login",
        "POST",
        "https://nexus.test",
        JSON.stringify({ email: "user@nexus.test", password: "Secret123!" }),
      ),
    );
    expect(response.status).toBe(200);
    const cookie = response.headers.get("set-cookie") ?? "";
    for (const attribute of [
      "nexus_session=ses_login",
      "HttpOnly",
      "Secure",
      "SameSite=lax",
      "Path=/",
      "Max-Age=1209600",
    ])
      expect(cookie).toContain(attribute);
    expect(cookie).not.toContain("Domain=");
    expect(JSON.stringify(await response.json())).not.toContain("ses_login");
  });

  it.each(mutations.filter(([path]) => path !== "session"))(
    "rejects simple form encoding on %s %s",
    async (path, method, handler) => {
      expect(
        (await handler(request(path, method, "https://nexus.test", "{}", "text/plain"))).status,
      ).toBe(415);
      expect(authService.login).not.toHaveBeenCalled();
      expect(authService.register).not.toHaveBeenCalled();
      expect(authService.confirmPasswordReset).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["login", login],
    ["register", register],
    ["password-reset", resetRequest],
  ] as const)("bounds streamed %s JSON independently of Content-Length", async (path, handler) => {
    const input = request(path, "POST", "https://nexus.test", "x".repeat(8193));
    const response = await handler(input);
    expect(response.status).toBe(413);
    expect(authService.login).not.toHaveBeenCalled();
    expect(authService.register).not.toHaveBeenCalled();
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe("global API browser boundary", () => {
  it("protects multipart and admin mutations without trusting bearer headers", () => {
    for (const path of [
      "/api/admin/licenses/maintenance",
      "/api/products/p/builds",
      "/api/auth/login",
    ]) {
      const input = new NextRequest(`https://nexus.test${path}`, {
        method: "POST",
        headers: { origin: "https://evil.test", authorization: "Bearer forged" },
      });
      expect(proxy(input).status).toBe(403);
    }
  });
  it("leaves exact bearer runtime routes to their independent token checks", () => {
    for (const path of ["/api/licenses/check", "/api/licenses/check-release"]) {
      const response = proxy(new NextRequest(`https://nexus.test${path}`, { method: "POST" }));
      expect(response.headers.get("x-middleware-next")).toBe("1");
    }
  });
});
