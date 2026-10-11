import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { createLicenseRuntimeToken } from "@nexus/security";

const state = vi.hoisted(() => ({
  user: { id: "usr_a", role: "user" } as {
    id: string;
    role: "user" | "moderator" | "admin";
  } | null,
  allowed: true,
  verify: vi.fn(),
  verifyRelease: vi.fn(),
  historyPage: vi.fn(),
  releasePage: vi.fn(),
  archive: vi.fn(),
  preview: vi.fn(),
  ownerCommand: vi.fn(),
  moderate: vi.fn(),
  detail: vi.fn(),
  servers: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  licenseRepository: { pageUserHistory: state.archive },
  licenseMaintenanceRepository: { preview: state.preview },
  licenseControlsRepository: {
    verify: state.verify,
    verifyRelease: state.verifyRelease,
    historyPage: state.historyPage,
    releasePage: state.releasePage,
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
import { POST as checkRelease } from "../apps/web/src/app/api/licenses/check-release/route";
import { GET as archive } from "../apps/web/src/app/api/licenses/route";
import { GET as archiveExport } from "../apps/web/src/app/api/licenses/export/route";
import { GET as maintenance } from "../apps/web/src/app/api/admin/licenses/maintenance/route";
import { GET as runtimeConfig } from "../apps/web/src/app/api/licenses/[id]/runtime-config/route";
import { GET as activity } from "../apps/web/src/app/api/licenses/[id]/activity/route";
import { GET as staffActivity } from "../apps/web/src/app/api/admin/licenses/[id]/activity/route";
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
    state.verifyRelease,
    state.historyPage,
    state.releasePage,
    state.archive,
    state.preview,
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
const release = {
  serverId: "srv_a",
  productId: "prd_a",
  buildId: "bld_a",
  sha256Hash: "a".repeat(64),
  nonce: "cc98ca86-5a01-4b7f-b2ac-1eabbeff533f",
};
it("authenticates archive/export, preserves private filters and rate limits inspection", async () => {
  const date = new Date(revision);
  state.archive.mockResolvedValue({
    licenses: [
      {
        id: "lic_a",
        productTitle: "Resource",
        effectiveStatus: "expired",
        model: "single_server",
        expiresAt: date,
        createdAt: date,
        serverBound: true,
      },
    ],
    page: 2,
    totalPages: 3,
  });
  const query = "?page=2&status=expired&binding=bound&term=finite&sort=expires_soon&q=Resource";
  expect((await archive(new NextRequest(`https://nexus.test/api/licenses${query}`))).status).toBe(
    200,
  );
  expect(state.archive).toHaveBeenCalledWith("usr_a", 2, {
    page: 2,
    status: "expired",
    binding: "bound",
    term: "finite",
    sort: "expires_soon",
    q: "Resource",
  });
  const response = await archiveExport(
    new NextRequest(`https://nexus.test/api/licenses/export${query}`),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toContain("text/csv");
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(response.headers.get("content-disposition")).toContain("licenses-page-2.csv");
  const csv = await response.text();
  expect(csv).toContain("Resource");
  expect(csv).not.toContain("usr_a");
  state.allowed = false;
  expect(
    (await archiveExport(new NextRequest("https://nexus.test/api/licenses/export"))).status,
  ).toBe(429);
});
it("denies guest archive requests and refuses unbounded or foreign-account filters", async () => {
  state.user = null;
  expect((await archive(new NextRequest("https://nexus.test/api/licenses"))).status).toBe(401);
  state.user = { id: "usr_a", role: "user" };
  for (const query of ["page=1&page=2", "userId=usr_other", `q=${"x".repeat(121)}`, "limit=100000"])
    expect(
      (await archiveExport(new NextRequest(`https://nexus.test/api/licenses/export?${query}`)))
        .status,
    ).toBe(400);
  expect(state.archive).not.toHaveBeenCalled();
});
it("restricts term maintenance inspection to admins while rechecking database authority", async () => {
  const request = new NextRequest("https://nexus.test/api/admin/licenses/maintenance?page=2");
  expect((await maintenance(request)).status).toBe(403);
  state.user = { id: "usr_a", role: "moderator" };
  expect((await maintenance(request)).status).toBe(403);
  expect(state.preview).not.toHaveBeenCalled();
  state.user = { id: "usr_a", role: "admin" };
  state.preview.mockResolvedValue({ items: [], page: 2, totalPages: 2 });
  expect((await maintenance(request)).status).toBe(200);
  expect(state.preview).toHaveBeenCalledWith("usr_a", 2);
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
it("requires observed endpoint recovery and returns only binding acknowledgement, without a fresh bearer", async () => {
  const command = {
    action: "refresh_binding",
    expectedUpdatedAt: revision,
    expectedEndpointRevision: 3,
    reason: "Control proof reapproved",
  };
  state.ownerCommand.mockResolvedValue({
    license: { id: "lic_a", status: "active", serverBound: true, updatedAt: updated },
    binding: { endpointRevision: 3, tokenRevoked: true },
  });
  const response = await ownerAction(request("/api/licenses/lic_a/actions", command), context);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    license: { id: "lic_a", status: "active", serverBound: true, updatedAt: updated },
    binding: { endpointRevision: 3, tokenRevoked: true },
  });
  expect(state.ownerCommand.mock.calls[0][0]).toMatchObject({
    actorId: "usr_a",
    licenseId: "lic_a",
    command,
  });
  expect(state.ownerCommand.mock.calls[0][0].tokenDigest).toBeUndefined();
  expect(
    (
      await ownerAction(
        request("/api/licenses/lic_a/actions", { ...command, serverId: "srv_other" }),
        context,
      )
    ).status,
  ).toBe(422);
});
it("scopes private configuration and history to the current buyer and paginates staff under live checks", async () => {
  state.releasePage.mockResolvedValue({
    licenseId: "lic_a",
    productId: "prd_a",
    serverId: "srv_a",
    items: [],
    page: 2,
    pageSize: 20,
    totalPages: 2,
    total: 20,
  });
  state.historyPage.mockResolvedValue({
    license: { id: "lic_a", productTitle: "Resource" },
    items: [],
    page: 2,
    totalPages: 2,
  });
  const config = await runtimeConfig(
    new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?page=2"),
    context,
  );
  expect(config.status).toBe(200);
  expect(config.headers.get("cache-control")).toBe("private, no-store");
  expect(state.releasePage).toHaveBeenCalledWith("lic_a", "usr_a", 2);
  expect(
    (
      await activity(
        new NextRequest("https://nexus.test/api/licenses/lic_a/activity?page=2"),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.historyPage).toHaveBeenCalledWith("lic_a", "usr_a", false, 2);
  expect(
    (
      await staffActivity(
        new NextRequest("https://nexus.test/api/admin/licenses/lic_a/activity"),
        context,
      )
    ).status,
  ).toBe(403);
  state.user = { id: "usr_a", role: "moderator" };
  expect(
    (
      await staffActivity(
        new NextRequest("https://nexus.test/api/admin/licenses/lic_a/activity?page=2"),
        context,
      )
    ).status,
  ).toBe(200);
  expect(state.historyPage).toHaveBeenCalledWith("lic_a", "usr_a", true, 2);
});
it("rejects ambiguous private filters and guests without loading any private configuration", async () => {
  for (const route of [runtimeConfig, activity]) {
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?page=1&page=2"),
          context,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config?ownerId=usr_other"),
          context,
        )
      ).status,
    ).toBe(400);
    state.user = null;
    expect(
      (
        await route(
          new NextRequest("https://nexus.test/api/licenses/lic_a/runtime-config"),
          context,
        )
      ).status,
    ).toBe(401);
    state.user = { id: "usr_a", role: "user" };
  }
  expect(state.releasePage).not.toHaveBeenCalled();
  expect(state.historyPage).not.toHaveBeenCalled();
});
