import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLicenseRuntimeToken } from "@nexus/security";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as { id: string; role: "user" | "moderator" } | null,
  allowed: true,
  verify: vi.fn(),
  ownerCommand: vi.fn(),
  moderate: vi.fn(),
  detail: vi.fn(),
  servers: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  licenseControlsRepository: {
    verify: state.verify,
    ownerCommand: state.ownerCommand,
    moderate: state.moderate,
    detail: state.detail,
    eligibleServers: state.servers,
  },
}));
vi.mock("@nexus/security", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@nexus/security")>()),
  consumeRateLimit: vi.fn(async () => ({ success: state.allowed })),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.user },
}));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({ getTrustedRequestIp: () => "unknown" }));
import { POST as check } from "../apps/web/src/app/api/licenses/check/route";
import { POST as ownerAction } from "../apps/web/src/app/api/licenses/[id]/actions/route";
import { POST as moderationAction } from "../apps/web/src/app/api/admin/licenses/[id]/route";
import { GET as detail } from "../apps/web/src/app/api/licenses/[id]/route";
const context = { params: Promise.resolve({ id: "lic_a" }) };
const revision = "2026-10-10T00:00:00.000Z";
const updated = "2026-10-10T01:00:00.000Z";
function request(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://nexus.test${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  state.user = { id: "usr_a", role: "user" };
  state.allowed = true;
  for (const mock of [
    state.verify,
    state.ownerCommand,
    state.moderate,
    state.detail,
    state.servers,
  ])
    mock.mockReset();
});
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
it("keeps owner mutations authenticated, JSON-only and same-origin", async () => {
  const body = { action: "revoke", expectedUpdatedAt: revision, reason: "Revoke this license" };
  state.user = null;
  expect((await ownerAction(request("/api/licenses/lic_a/actions", body), context)).status).toBe(
    401,
  );
  state.user = { id: "usr_a", role: "user" };
  expect(
    (
      await ownerAction(
        request("/api/licenses/lic_a/actions", body, { "content-type": "text/plain" }),
        context,
      )
    ).status,
  ).toBe(415);
  expect(
    (
      await ownerAction(
        request("/api/licenses/lic_a/actions", body, { "sec-fetch-site": "cross-site" }),
        context,
      )
    ).status,
  ).toBe(403);
  expect(state.ownerCommand).not.toHaveBeenCalled();
});
it("returns a rotation bearer once while the repository receives only its digest", async () => {
  const expiresAt = new Date(Date.now() + 86400000);
  state.ownerCommand.mockResolvedValue({
    license: { id: "lic_a", status: "active", updatedAt: updated, serverBound: true },
    tokenExpiresAt: expiresAt,
  });
  const response = await ownerAction(
    request("/api/licenses/lic_a/actions", {
      action: "rotate_token",
      expectedUpdatedAt: revision,
      reason: "Replace credential",
    }),
    context,
  );
  const body = await response.json();
  expect(body.token.value).toMatch(/^nxlt_[A-Za-z0-9_-]{43}$/u);
  expect(state.ownerCommand.mock.calls[0][0].tokenDigest).toMatch(/^[a-f0-9]{64}$/u);
  expect(JSON.stringify(state.ownerCommand.mock.calls)).not.toContain(body.token.value);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
});
it("rejects buyer use of moderation and rejects caller-supplied extensions", async () => {
  const command = {
    action: "restore",
    expectedUpdatedAt: revision,
    reason: "Restore unchanged term",
  };
  expect(
    (await moderationAction(request("/api/admin/licenses/lic_a", command), context)).status,
  ).toBe(403);
  state.user = { id: "usr_a", role: "moderator" };
  expect(
    (
      await moderationAction(
        request("/api/admin/licenses/lic_a", { ...command, expiresAt: updated }),
        context,
      )
    ).status,
  ).toBe(422);
  expect(state.moderate).not.toHaveBeenCalled();
});
it("does not reveal another buyer's license detail", async () => {
  state.detail.mockResolvedValue(null);
  const response = await detail(new NextRequest("https://nexus.test/api/licenses/lic_a"), context);
  expect(state.detail).toHaveBeenCalledWith("lic_a", "usr_a");
  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({ code: "NOT_FOUND" });
});
