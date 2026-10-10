import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const state = vi.hoisted(() => ({
  actor: { id: "owner", role: "user" } as Record<string, unknown> | null,
}));
const mocks = vi.hoisted(() => ({
  pageMine: vi.fn(),
  leave: vi.fn(),
  getWorkspace: vi.fn(),
  create: vi.fn(),
  updateProfile: vi.fn(),
  addMember: vi.fn(),
  changeMember: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("@nexus/db", () => ({ organizationWorkspaceRepository: mocks }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: async () => state.actor },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: (p: string) => `${p}_new`,
}));
import { POST as leave } from "../apps/web/src/app/api/workspace/organizations/[id]/leave/route";
import { GET as list, POST as create } from "../apps/web/src/app/api/workspace/organizations/route";
import {
  GET as workspace,
  PATCH as profile,
} from "../apps/web/src/app/api/workspace/organizations/[id]/route";
import { POST as add } from "../apps/web/src/app/api/workspace/organizations/[id]/members/route";
import {
  PATCH as change,
  DELETE as remove,
} from "../apps/web/src/app/api/workspace/organizations/[id]/members/[userId]/route";
const version = "2026-10-10T12:00:00.000Z";
const fields = { name: "Team", description: "Description", logoUrl: "", websiteUrl: "" };
const stored = {
  ...fields,
  id: "org",
  slug: "team",
  ownerId: "owner",
  isVerified: false,
  createdAt: new Date(version),
  updatedAt: new Date(version),
};
const context = { params: Promise.resolve({ id: "org", userId: "member" }) };
function request(method: string, body?: unknown, locale = "en", headers = {}) {
  return new NextRequest("http://nexus.test/api/workspace/organizations?page=2&q=team", {
    method,
    headers: {
      cookie: `nexus_session=test;nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.actor = { id: "owner", role: "user" };
  mocks.rate.mockResolvedValue({ success: true });
  mocks.pageMine.mockResolvedValue({
    items: [{ ...stored, role: "owner" }],
    page: 2,
    hasMore: false,
  });
  mocks.getWorkspace.mockResolvedValue({
    organization: stored,
    role: "owner",
    owner: null,
    members: [],
    page: 2,
    hasMore: false,
  });
  mocks.create.mockResolvedValue(stored);
  mocks.updateProfile.mockResolvedValue(stored);
  mocks.addMember.mockResolvedValue({
    organization: stored,
    member: {
      id: "member",
      username: "member",
      displayName: "Member",
      avatarUrl: null,
      role: "developer",
      managesServers: true,
    },
  });
  mocks.changeMember.mockResolvedValue({ organization: stored, userId: "member", removed: true });
});
it("returns private bounded member-scoped organization lists", async () => {
  const response = await list(request("GET"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.pageMine).toHaveBeenCalledWith("owner", 2, "team");
  expect((await response.json()).items[0]).not.toHaveProperty("createdAt");
});
it("scopes a workspace read to the authenticated account", async () => {
  expect((await workspace(request("GET"), context)).status).toBe(200);
  expect(mocks.getWorkspace).toHaveBeenCalledWith("org", "owner", 2, "team");
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
    expect.objectContaining({ action: "organization.created", actorId: "owner" }),
  );
});
it.each([{ ownerId: "victim" }, { isVerified: true }, { permissions: ["manage_products"] }])(
  "rejects client authority injection %j",
  async (extra) => {
    expect((await create(request("POST", { ...fields, slug: "team", ...extra }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  },
);
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

it("scopes voluntary exit to the session user and a required revision", async () => {
  mocks.leave.mockResolvedValue({ organization: stored, userId: "owner", removed: true });
  expect((await leave(request("POST", { expectedUpdatedAt: version }), context)).status).toBe(200);
  expect(mocks.leave).toHaveBeenCalledWith(
    "org",
    "owner",
    new Date(version),
    expect.objectContaining({ action: "organization.member_left" }),
  );
  expect(
    (await leave(request("POST", { expectedUpdatedAt: version, userId: "victim" }), context))
      .status,
  ).toBe(400);
});
