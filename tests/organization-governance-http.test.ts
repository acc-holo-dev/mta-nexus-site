import { AppError, UnauthorizedError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  transfer: vi.fn(),
  history: vi.fn(),
  findByEmail: vi.fn(),
  verifyPassword: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("@nexus/db", () => ({
  organizationGovernanceRepository: mocks,
  organizationWorkspaceRepository: {},
  userRepository: { findByEmail: mocks.findByEmail },
}));
vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: (prefix: string) => `${prefix}_new`,
  verifyPassword: mocks.verifyPassword,
  freshAuthProofAccepted: () => true,
}));

import { GET } from "../apps/web/src/app/api/workspace/organizations/[id]/activity/route";
import { POST } from "../apps/web/src/app/api/workspace/organizations/[id]/ownership/route";

const time = "2026-10-11T00:00:00.000Z",
  actor = { id: "owner", role: "user", email: "owner@nexus.test" },
  context = { params: Promise.resolve({ id: "org" }) };
const transfer = {
  targetId: "target",
  targetUsername: " target ",
  confirmationSlug: "team",
  currentPassword: "Current-password-123!",
  formerOwnerRole: "member",
  expectedUpdatedAt: time,
};
const organization = {
  id: "org",
  name: "Team",
  slug: "team",
  ownerId: "target",
  isVerified: true,
  description: null,
  logoUrl: null,
  websiteUrl: null,
  createdAt: new Date(time),
  updatedAt: new Date("2026-10-11T00:00:01Z"),
};
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api/workspace/organizations/org/activity${query}`, {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
afterEach(() => {
  vi.unstubAllEnvs();
});
beforeEach(() => {
  stubBrowserMutationOrigin();
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.findByEmail.mockResolvedValue({
    id: "owner",
    email: "owner@nexus.test",
    passwordHash: "owner-password-hash",
  });
  mocks.verifyPassword.mockResolvedValue(true);
  mocks.transfer.mockResolvedValue({
    organization,
    role: "member",
    owner: {
      id: "target",
      username: "target",
      displayName: "Target",
      avatarUrl: null,
      email: "PRIVATE",
    },
    previousOwnerId: "owner",
    details: "PRIVATE",
  });
  mocks.history.mockResolvedValue({
    organization: { id: "org", name: "Team", slug: "team" },
    until: "2026-10-12T00:00:00.123456Z",
    period: "all",
    group: "all",
    query: "",
    items: [],
    hasMore: false,
    nextCursor: null,
  });
});
it("binds transfer and private history to the actual session with versioned inputs", async () => {
  const response = await POST(request("POST", transfer), context);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
  expect(mocks.verifyPassword).toHaveBeenCalledWith("Current-password-123!", "owner-password-hash");
  expect(mocks.transfer).toHaveBeenCalledWith({
    targetId: "target",
    targetUsername: "target",
    confirmationSlug: "team",
    formerOwnerRole: "member",
    expectedPasswordHash: "owner-password-hash",
    expectedUpdatedAt: new Date(time),
    actorId: "owner",
    currentToken: "test",
    id: "org",
    memberId: "mem_new",
    auditId: "aud_new",
  });
  expect(JSON.stringify(mocks.transfer.mock.calls)).not.toContain("Current-password-123!");
  const history = await GET(request("GET", undefined, "?before=audit_1"), context);
  expect(history.status).toBe(200);
  expect(mocks.history).toHaveBeenCalledWith(
    "org",
    "owner",
    "audit_1",
    expect.objectContaining({ period: "all", group: "all", query: "", before: "audit_1" }),
  );
});
it("rejects a missing initiating cookie before reading the body even with a stale resolved actor", async () => {
  const incoming = request("POST", transfer, "", { cookie: "nexus_locale=ru" });
  const read = vi.spyOn(incoming, "json");
  expect((await POST(incoming, context)).status).toBe(401);
  expect(read).not.toHaveBeenCalled();
  expect(incoming.bodyUsed).toBe(false);
  expect(mocks.rate).not.toHaveBeenCalled();
  expect(mocks.transfer).not.toHaveBeenCalled();
});
it("propagates a transactional session rejection without confirming a transfer", async () => {
  mocks.transfer.mockRejectedValue(new UnauthorizedError("private session details"));
  const response = await POST(request("POST", transfer), context);
  expect(response.status).toBe(401);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
});
it("denies anonymous access and forged actor/owner/commercial fields before storage", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await POST(request("POST", transfer), context)).status).toBe(401);
  expect((await GET(request(), context)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  for (const extra of [
    { actorId: "victim" },
    { ownerId: "victim" },
    { formerOwnerRole: "owner" },
    { permissions: ["manage_products"] },
    { currentToken: "forged-token" },
  ])
    expect((await POST(request("POST", { ...transfer, ...extra }), context)).status).toBe(400);
  for (const query of ["?actorId=owner", "?before=a&before=b", "?limit=1000"])
    expect((await GET(request("GET", undefined, query), context)).status).toBe(400);
  expect(mocks.transfer).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
});
it("requires bounded same-site JSON and rate limits for both operations", async () => {
  expect(
    (await POST(request("POST", transfer, "", { "sec-fetch-site": "cross-site" }), context)).status,
  ).toBe(403);
  expect(
    (await POST(request("POST", transfer, "", { "content-type": "text/plain" }), context)).status,
  ).toBe(415);
  expect(
    (await POST(request("POST", { ...transfer, targetUsername: "x".repeat(40000) }), context))
      .status,
  ).toBe(413);
  mocks.rate.mockResolvedValue({ success: false });
  expect((await POST(request("POST", transfer), context)).status).toBe(429);
  expect((await GET(request(), context)).status).toBe(429);
  expect(mocks.transfer).not.toHaveBeenCalled();
  expect(mocks.history).not.toHaveBeenCalled();
});
it("returns localized ownership, live-version and expired-history failures without false confirmations", async () => {
  for (const [code, status] of [
    ["OWNERSHIP_OWNER_REQUIRED", 403],
    ["OWNERSHIP_TARGET_INVALID", 409],
    ["CONFLICT", 409],
  ] as const) {
    mocks.transfer.mockRejectedValue(new AppError("private details", status, code));
    const response = await POST(request("POST", transfer), context);
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain("private details");
  }
  mocks.history.mockRejectedValue(
    new AppError("private details", 404, "ORGANIZATION_HISTORY_EXPIRED"),
  );
  expect((await GET(request(), context)).status).toBe(404);
  mocks.transfer.mockRejectedValue(new Error("secret SQL"));
  const uncertain = await POST(request("POST", transfer), context);
  expect(uncertain.status).toBe(503);
  expect((await uncertain.json()).error).toMatch(/подтвердить/u);
});
it("projects only safe history DTOs even when storage returns extra contact/audit fields", async () => {
  mocks.history.mockResolvedValue({
    organization: { id: "org", name: "Team", slug: "team", websiteUrl: "PRIVATE" },
    until: "2026-10-12T00:00:00.123456Z",
    period: "all",
    group: "all",
    query: "",
    items: [
      {
        id: "audit",
        action: "organization.member_left",
        createdAt: "2026-10-11T00:00:00.000123Z",
        actorName: "Owner",
        actorUsername: "owner",
        subjectUsername: "target",
        subjectName: "Target",
        fromRole: "member",
        toRole: null,
        fields: [],
        managesServers: null,
        details: "PRIVATE",
        email: "PRIVATE",
        ipAddress: "PRIVATE",
      },
    ],
    hasMore: false,
    nextCursor: null,
  });
  const response = await GET(request(), context);
  expect(response.status).toBe(200);
  expect(JSON.stringify(await response.json())).not.toContain("PRIVATE");
});
