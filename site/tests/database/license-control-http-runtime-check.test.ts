import { createLicenseRuntimeToken } from "@nexus/security";
import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createLicenseControlHttpDbMock } = await import(
    "../helpers/license-control-http-harness"
  );
  return createLicenseControlHttpDbMock();
});
vi.mock("@nexus/security", async (importOriginal) => {
  const { licenseControlHttpState } = await import("../helpers/license-control-http-harness");
  return {
    ...(await importOriginal<typeof import("@nexus/security")>()),
    consumeRateLimit: vi.fn(async () => ({ success: licenseControlHttpState.allowed })),
  };
});
vi.mock("../../src/lib/services/auth-service", async () => {
  const { licenseControlHttpState } = await import("../helpers/license-control-http-harness");
  return {
    authService: { getSession: async () => licenseControlHttpState.user },
  };
});
vi.mock("../../src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "unknown",
}));

import { POST as check } from "../../src/app/api/licenses/check/route";
import { POST as checkRelease } from "../../src/app/api/licenses/check-release/route";
import {
  installLicenseControlHttpLifecycle,
  releaseProbe as release,
  licenseControlHttpRequest as request,
  revision,
  licenseControlHttpState as state,
  updated,
} from "../helpers/license-control-http-harness";

installLicenseControlHttpLifecycle();

it("accepts only bearer runtime credentials; cookie sessions and legacy keys cannot check a binding", async () => {
  for (const authorization of ["", "Bearer legacy-key", "Basic anything"]) {
    const response = await check(
      request(
        "/api/licenses/check",
        { serverId: "srv_a" },
        { authorization, cookie: "nexus_session=session" },
      ),
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ valid: false, code: "UNAUTHORIZED" });
  }
  expect(state.verify).not.toHaveBeenCalled();
});

it("uses a hashed credential and returns private minimal verification output", async () => {
  const token = createLicenseRuntimeToken();
  const result = {
    valid: true,
    licenseId: "lic_a",
    productId: "prd_a",
    serverId: "srv_a",
    expiresAt: updated,
    checkedAt: revision,
    recheckAfterSeconds: 60,
  };
  state.verify.mockResolvedValue(result);
  const response = await check(
    request(
      "/api/licenses/check",
      { serverId: "srv_a" },
      { authorization: `Bearer ${token.value}` },
    ),
  );
  expect(response.status).toBe(200);
  expect(state.verify).toHaveBeenCalledWith(token.digest, "srv_a");
  expect(await response.json()).toEqual(result);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(JSON.stringify(result)).not.toContain(token.value);
});

it("uses one denial for revoked, expired, moved or invalid runtime bindings", async () => {
  state.verify.mockResolvedValue(null);
  const response = await check(
    request(
      "/api/licenses/check",
      { serverId: "srv_a" },
      { authorization: `Bearer ${createLicenseRuntimeToken().value}` },
    ),
  );
  expect(response.status).toBe(401);
  expect(await response.json()).toEqual({ valid: false, code: "LICENSE_CHECK_DENIED" });
});

it("bounds and strictly validates runtime bodies before querying a license", async () => {
  for (const body of [
    { serverId: "srv_a", expiresAt: updated },
    { serverId: "x".repeat(5000) },
    { serverId: "https://other" },
  ]) {
    const response = await check(
      request("/api/licenses/check", body, {
        authorization: `Bearer ${createLicenseRuntimeToken().value}`,
      }),
    );
    expect([413, 422]).toContain(response.status);
  }
  expect(state.verify).not.toHaveBeenCalled();
});

it("rate limits runtime checks and never falls back to a permissive grant", async () => {
  state.allowed = false;
  const response = await check(
    request(
      "/api/licenses/check",
      { serverId: "srv_a" },
      { authorization: `Bearer ${createLicenseRuntimeToken().value}` },
    ),
  );
  expect(response.status).toBe(429);
  expect(state.verify).not.toHaveBeenCalled();
});

it("authenticates release checks solely with a hashed bearer and returns private, correlated output", async () => {
  const token = createLicenseRuntimeToken();
  const result = {
    ...release,
    valid: true,
    licenseId: "lic_a",
    version: "1.0",
    checkedAt: revision,
    expiresAt: updated,
    leaseExpiresAt: "2026-10-10T00:01:00.000Z",
    recheckAfterSeconds: 30,
  };
  state.verifyRelease.mockResolvedValue(result);
  const response = await checkRelease(
    request("/api/licenses/check-release", release, {
      authorization: `Bearer ${token.value}`,
      "x-request-id": "license-release-probe",
    }),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(result);
  expect(state.verifyRelease).toHaveBeenCalledWith(token.digest, release);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Authorization");
  expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/u);
  expect(JSON.stringify(state.verifyRelease.mock.calls)).not.toContain(token.value);
});

it("denies cookie-only release checks, invalid bodies, unsafe extensions and unavailable bindings", async () => {
  expect(
    (
      await checkRelease(
        request("/api/licenses/check-release", release, { cookie: "nexus_session=session" }),
      )
    ).status,
  ).toBe(401);
  const authorization = `Bearer ${createLicenseRuntimeToken().value}`;
  for (const extra of [
    { nonce: "arbitrary" },
    { productId: "https://other" },
    { sha256Hash: "wrong" },
    { expiresAt: updated },
    { buildId: "x".repeat(5000) },
  ])
    expect([413, 422]).toContain(
      (
        await checkRelease(
          request("/api/licenses/check-release", { ...release, ...extra }, { authorization }),
        )
      ).status,
    );
  expect(state.verifyRelease).not.toHaveBeenCalled();
  state.verifyRelease.mockResolvedValue(null);
  const denied = await checkRelease(
    request("/api/licenses/check-release", release, { authorization }),
  );
  expect(denied.status).toBe(401);
  expect(await denied.json()).toEqual({ valid: false, code: "LICENSE_CHECK_DENIED" });
  state.allowed = false;
  expect(
    (await checkRelease(request("/api/licenses/check-release", release, { authorization }))).status,
  ).toBe(429);
});
