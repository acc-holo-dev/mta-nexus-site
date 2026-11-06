import { AppError } from "@nexus/domain";
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

import { POST as leave } from "../apps/web/src/app/api/workspace/organizations/[id]/leave/route";
import {
  PATCH as change,
  DELETE as remove,
} from "../apps/web/src/app/api/workspace/organizations/[id]/members/[userId]/route";
import { POST as add } from "../apps/web/src/app/api/workspace/organizations/[id]/members/route";
import {
  PATCH as profile,
  GET as workspace,
} from "../apps/web/src/app/api/workspace/organizations/[id]/route";
import {
  installOrganizationWorkspaceHttpHooks,
  organizationWorkspaceHttpContext as context,
  organizationWorkspaceHttpFields as fields,
  organizationWorkspaceHttpMocks as mocks,
  organizationWorkspaceHttpRequest as request,
  organizationWorkspaceHttpStored as stored,
  organizationWorkspaceHttpVersion as version,
} from "./helpers/organization-workspace-http-harness";

installOrganizationWorkspaceHttpHooks();

it("scopes a workspace read to the authenticated account", async () => {
  expect((await workspace(request("GET"), context)).status).toBe(200);
  expect(mocks.getWorkspace).toHaveBeenCalledWith("org", "owner", 2, "team");
});
it("passes immutable profile identity and an optimistic revision to the write path", async () => {
  expect(
    (await profile(request("PATCH", { ...fields, expectedUpdatedAt: version }), context)).status,
  ).toBe(200);
  expect(mocks.updateProfile).toHaveBeenCalledWith(
    "org",
    "owner",
    new Date(version),
    fields,
    expect.objectContaining({ action: "organization.profile_updated" }),
    "test",
  );
  expect(
    (
      await profile(
        request("PATCH", { ...fields, slug: "changed", expectedUpdatedAt: version }),
        context,
      )
    ).status,
  ).toBe(400);
});
it("rejects a changed actor before team mutations and private workspace refresh", async () => {
  const other = { "x-nexus-actor-id": "other" };
  expect(
    (
      await add(
        request(
          "POST",
          { username: "member", role: "member", managesServers: false, expectedUpdatedAt: version },
          "en",
          other,
        ),
        context,
      )
    ).status,
  ).toBe(409);
  expect(
    (await remove(request("DELETE", { expectedUpdatedAt: version }, "en", other), context)).status,
  ).toBe(409);
  expect(
    (await leave(request("POST", { expectedUpdatedAt: version }, "en", other), context)).status,
  ).toBe(409);
  expect((await workspace(request("GET", undefined, "en", other), context)).status).toBe(409);
  expect(mocks.addMember).not.toHaveBeenCalled();
  expect(mocks.changeMember).not.toHaveBeenCalled();
  expect(mocks.leave).not.toHaveBeenCalled();
});
it("adds a bounded exact username and delegated server permission", async () => {
  expect(
    (
      await add(
        request("POST", {
          username: "member",
          role: "developer",
          managesServers: true,
          expectedUpdatedAt: version,
        }),
        context,
      )
    ).status,
  ).toBe(201);
  expect(mocks.addMember).toHaveBeenCalledWith(
    "org",
    "owner",
    new Date(version),
    "member",
    "developer",
    true,
    "mem_new",
    expect.objectContaining({ action: "organization.member_added" }),
    "test",
  );
});
it("requires a revision for member changes and deletion", async () => {
  expect(
    (
      await change(
        request("PATCH", { role: "member", managesServers: false, expectedUpdatedAt: version }),
        context,
      )
    ).status,
  ).toBe(200);
  expect((await remove(request("DELETE", { expectedUpdatedAt: version }), context)).status).toBe(
    200,
  );
  expect(mocks.changeMember).toHaveBeenLastCalledWith(
    "org",
    "owner",
    new Date(version),
    "member",
    null,
    expect.objectContaining({ action: "organization.member_removed" }),
    "test",
  );
  expect((await remove(request("DELETE", {}), context)).status).toBe(400);
});
it.each(["MEMBER_PROTECTED", "MEMBER_EXISTS", "CONFLICT"])(
  "preserves transaction errors and localizes %s",
  async (code) => {
    mocks.changeMember.mockRejectedValue(new AppError("Private database message", 409, code));
    const response = await remove(request("DELETE", { expectedUpdatedAt: version }, "ru"), context);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code });
  },
);
it("scopes voluntary exit to the session user and a required revision", async () => {
  mocks.leave.mockResolvedValue({ organization: stored, userId: "owner", removed: true });
  expect((await leave(request("POST", { expectedUpdatedAt: version }), context)).status).toBe(200);
  expect(mocks.leave).toHaveBeenCalledWith(
    "org",
    "owner",
    new Date(version),
    expect.objectContaining({ action: "organization.member_left" }),
    "test",
  );
  expect(
    (await leave(request("POST", { expectedUpdatedAt: version, userId: "victim" }), context))
      .status,
  ).toBe(400);
});
it("rejects a profile edit from a different displayed account", async () => {
  const response = await profile(
    request("PATCH", { ...fields, expectedUpdatedAt: version }, "en", {
      "x-nexus-actor-id": "other",
    }),
    context,
  );
  expect(response.status).toBe(409);
  expect(mocks.updateProfile).not.toHaveBeenCalled();
});
