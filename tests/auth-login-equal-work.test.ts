import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  findByEmail: vi.fn(),
  createLoginSession: vi.fn(),
  verifyPassword: vi.fn(),
  consumeRateLimit: vi.fn(),
}));

vi.mock("@nexus/db", () => ({
  userRepository: { findByEmail: mocks.findByEmail },
  authRepository: { createLoginSession: mocks.createLoginSession },
}));
vi.mock("@nexus/security", async (original) => ({
  ...(await original<typeof import("@nexus/security")>()),
  verifyPassword: mocks.verifyPassword,
  consumeRateLimit: mocks.consumeRateLimit,
}));
vi.mock("../site/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "127.0.0.1",
}));

import { POST } from "../site/src/app/api/auth/login/route";
import { authService } from "../site/src/lib/services/auth-service";

beforeEach(() => vi.resetAllMocks());
afterEach(() => vi.unstubAllEnvs());

it("runs a valid dummy scrypt verification for unknown accounts and never accepts its result", async () => {
  mocks.findByEmail.mockResolvedValue(null);
  // Even a matching dummy password must never authenticate an unknown account.
  mocks.verifyPassword.mockResolvedValue(true);
  await expect(
    authService.login({ email: "missing@nexus.test", password: "nexus-public-dummy-password" }),
  ).rejects.toMatchObject({ statusCode: 401 });
  expect(mocks.verifyPassword).toHaveBeenCalledOnce();
  const [password, dummyHash] = mocks.verifyPassword.mock.calls[0];
  const security = await vi.importActual<typeof import("@nexus/security")>("@nexus/security");
  expect(await security.verifyPassword(password, dummyHash)).toBe(true);
  expect(mocks.createLoginSession).not.toHaveBeenCalled();
});

it("uses the stored hash and denies an incorrect password without a session", async () => {
  mocks.findByEmail.mockResolvedValue({ id: "usr_1", passwordHash: "stored-hash" });
  mocks.verifyPassword.mockResolvedValue(false);
  await expect(
    authService.login({ email: "user@nexus.test", password: "wrong" }),
  ).rejects.toMatchObject({ statusCode: 401 });
  expect(mocks.verifyPassword).toHaveBeenCalledExactlyOnceWith("wrong", "stored-hash");
  expect(mocks.createLoginSession).not.toHaveBeenCalled();
});

it("applies the login rate limit before any password work", async () => {
  stubBrowserMutationOrigin();
  mocks.consumeRateLimit.mockResolvedValue({ success: false });
  const response = await POST(
    new NextRequest("https://nexus.test/api/auth/login", {
      method: "POST",
      headers: { ...browserMutationHeaders(), "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@nexus.test", password: "wrong" }),
    }),
  );
  expect(response.status).toBe(429);
  expect(mocks.consumeRateLimit).toHaveBeenCalledExactlyOnceWith("authLogin", "127.0.0.1");
  expect(mocks.findByEmail).not.toHaveBeenCalled();
  expect(mocks.verifyPassword).not.toHaveBeenCalled();
});
