import { expect, it, vi } from "vitest";

vi.mock("@nexus/db", async () => {
  const { createOrganizationWorkspaceHttpDbMock } = await import(
    "./helpers/organization-workspace-http-harness"
  );
  return createOrganizationWorkspaceHttpDbMock();
});
vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createOrganizationWorkspaceHttpAuthMock } = await import(
    "./helpers/organization-workspace-http-harness"
  );
  return createOrganizationWorkspaceHttpAuthMock();
});
vi.mock("@nexus/security", async () => {
  const { createOrganizationWorkspaceHttpSecurityMock } = await import(
    "./helpers/organization-workspace-http-harness"
  );
  return createOrganizationWorkspaceHttpSecurityMock();
});

import { POST as create, GET as list } from "../apps/web/src/app/api/workspace/organizations/route";
import {
  installOrganizationWorkspaceHttpHooks,
  organizationWorkspaceHttpFields as fields,
  organizationWorkspaceHttpMocks as mocks,
  organizationWorkspaceHttpRequest as request,
  organizationWorkspaceHttpState as state,
} from "./helpers/organization-workspace-http-harness";

installOrganizationWorkspaceHttpHooks();

it("returns private bounded member-scoped organization lists", async () => {
  const response = await list(request("GET"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.pageMine).toHaveBeenCalledWith("owner", 2, "team");
  expect((await response.json()).items[0]).not.toHaveProperty("createdAt");
});
it.each([list, create])("denies anonymous callers before repository access", async (handler) => {
  state.actor = null;
  const response = await handler(
    request(handler === list ? "GET" : "POST", handler === list ? undefined : fields, "ru"),
  );
  expect(response.status).toBe(401);
  expect(mocks.pageMine).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
it("creates only an unverified personal-account-owned organization", async () => {
  const response = await create(request("POST", { ...fields, slug: "team" }));
  expect(response.status).toBe(201);
  expect(mocks.create).toHaveBeenCalledWith(
    "org_new",
    "owner",
    "team",
    fields,
    expect.objectContaining({
      action: "organization.created",
      actorId: "owner",
      details: { creationNonce: "a".repeat(32) },
    }),
    "test",
  );
});
it("rejects a changed or missing actor before creating an organization", async () => {
  const changed = await create(
    request("POST", { ...fields, slug: "team" }, "en", { "x-nexus-actor-id": "other" }),
  );
  expect(changed.status).toBe(409);
  const missing = await create(
    request("POST", { ...fields, slug: "team" }, "en", { "x-nexus-actor-id": "" }),
  );
  expect(missing.status).toBe(428);
  expect(mocks.create).not.toHaveBeenCalled();
});
it.each([{ ownerId: "victim" }, { isVerified: true }, { permissions: ["manage_products"] }])(
  "rejects client authority injection %j",
  async (extra) => {
    expect((await create(request("POST", { ...fields, slug: "team", ...extra }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
it("rejects cross-site, wrong content type, oversize bodies and denied rate limits", async () => {
  expect(
    (
      await create(
        request("POST", { ...fields, slug: "team" }, "en", { "sec-fetch-site": "cross-site" }),
      )
    ).status,
  ).toBe(403);
  expect(
    (await create(request("POST", fields, "en", { "content-type": "text/plain" }))).status,
  ).toBe(415);
  expect(
    (await create(request("POST", { ...fields, description: "x".repeat(40000), slug: "team" })))
      .status,
  ).toBe(413);
  mocks.rate.mockResolvedValue({ success: false });
  expect((await create(request("POST", fields))).status).toBe(429);
  expect(mocks.create).not.toHaveBeenCalled();
});
it("maps slug collisions and hides unknown repository failures", async () => {
  mocks.create.mockRejectedValue({ cause: { code: "23505" } });
  const collision = await create(request("POST", { ...fields, slug: "team" }));
  expect(collision.status).toBe(409);
  expect(await collision.json()).toMatchObject({ code: "SLUG_CONFLICT" });
  mocks.pageMine.mockRejectedValue(new Error("secret database host"));
  const unavailable = await list(request("GET"));
  expect(unavailable.status).toBe(503);
  expect(JSON.stringify(await unavailable.json())).not.toContain("secret");
});
