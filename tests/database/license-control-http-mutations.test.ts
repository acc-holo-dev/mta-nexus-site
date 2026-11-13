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
vi.mock("../../site/src/lib/services/auth-service", async () => {
  const { licenseControlHttpState } = await import("../helpers/license-control-http-harness");
  return {
    authService: { getSession: async () => licenseControlHttpState.user },
  };
});
vi.mock("../../site/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "unknown",
}));

import { POST as moderationAction } from "../../site/src/app/api/admin/licenses/[id]/route";
import { POST as ownerAction } from "../../site/src/app/api/licenses/[id]/actions/route";
import {
  licenseControlHttpContext as context,
  installLicenseControlHttpLifecycle,
  licenseControlHttpRequest as request,
  revision,
  licenseControlHttpState as state,
  updated,
} from "../helpers/license-control-http-harness";

installLicenseControlHttpLifecycle();

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
  expect(state.ownerCommand.mock.calls[0][0].currentToken).toBe("initiating-session");
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
    actorId: "usr_a",
    license: { id: "lic_a", status: "active", serverBound: true, updatedAt: updated },
    binding: { endpointRevision: 3, tokenRevoked: true },
  });
  expect(state.ownerCommand.mock.calls[0][0]).toMatchObject({
    actorId: "usr_a",
    licenseId: "lic_a",
    command,
  });
  expect(state.ownerCommand.mock.calls[0][0].currentToken).toBe("initiating-session");
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

it("passes the initiating cookie separately from license credentials to moderation", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  state.moderate.mockResolvedValue({ license: { id: "lic_a", status: "suspended" } });
  const response = await moderationAction(
    request("/api/admin/licenses/lic_a", {
      action: "suspend",
      expectedUpdatedAt: revision,
      reason: "Suspend this license",
    }),
    context,
  );
  expect(response.status).toBe(200);
  expect(state.moderate).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "usr_a",
      currentToken: "initiating-session",
    }),
  );
  expect(state.moderate.mock.calls[0][0]).not.toHaveProperty("tokenDigest");
});

it("requires the initiating cookie before consuming owner or moderation command bodies", async () => {
  state.user = { id: "usr_a", role: "moderator" };
  for (const [route, path] of [
    [ownerAction, "/api/licenses/lic_a/actions"],
    [moderationAction, "/api/admin/licenses/lic_a"],
  ] as const) {
    const req = request(path, {}, { cookie: "" });
    if (!req.body) throw new Error("Missing command body");
    const read = vi.spyOn(req.body, "getReader");
    const response = await route(req, context);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ code: "UNAUTHORIZED" });
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(read).not.toHaveBeenCalled();
    expect(req.bodyUsed).toBe(false);
  }
  expect(state.ownerCommand).not.toHaveBeenCalled();
  expect(state.moderate).not.toHaveBeenCalled();
});

it.each(["owner", "admin"] as const)(
  "requires the originating actor for %s license mutation",
  async (kind) => {
    state.user = { id: "usr_a", role: kind === "admin" ? "admin" : "user" };
    const handler = kind === "admin" ? moderationAction : ownerAction;
    const body = { action: "revoke", reason: "Reviewed", expectedUpdatedAt: revision };
    expect(
      (await handler(request("/api/license", body, { "x-nexus-actor-id": "" }), context)).status,
    ).toBe(428);
    const response = await handler(
      request("/api/license", body, { "x-nexus-actor-id": "usr_b" }),
      context,
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: "ACTOR_CHANGED" });
    expect(state.ownerCommand).not.toHaveBeenCalled();
    expect(state.moderate).not.toHaveBeenCalled();
  },
);
