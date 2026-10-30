import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  overview: vi.fn(),
  targets: vi.fn(),
  ownProfile: vi.fn(),
  updateProfile: vi.fn(),
  apply: vi.fn(),
  decide: vi.fn(),
  after: vi.fn(),
}));
vi.mock("next/server", async (original) => ({
  ...(await original<typeof import("next/server")>()),
  after: mocks.after,
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService: mocks,
}));
vi.mock("@nexus/db", () => ({
  userRepository: { listModeratorIds: vi.fn() },
  notificationRepository: {},
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));

import { GET as own, PATCH as update } from "../apps/web/src/app/api/account/developer/route";
import { PATCH as decide } from "../apps/web/src/app/api/admin/verification/[id]/route";
import { GET as overview, POST } from "../apps/web/src/app/api/workspace/verification/route";
import { GET as targets } from "../apps/web/src/app/api/workspace/verification/targets/route";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const actor = { id: "actor", role: "developer" },
  context = { params: Promise.resolve({ id: "ver_application" }) };
const application = {
  targetType: "developer",
  targetId: "actor",
  proofUrl: "https://example.test/evidence",
  notes: " Project evidence ",
};
const profile = {
  specialties: ["Lua"],
  githubUrl: "https://github.com/example",
  discordTag: " dev ",
  expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
};
const decision = { decision: "approved", reviewNotes: " Reviewed evidence " };
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api/workspace/verification${query}`, {
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
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.overview.mockResolvedValue({});
  mocks.targets.mockResolvedValue({});
  mocks.ownProfile.mockResolvedValue({});
  mocks.updateProfile.mockResolvedValue({ id: actor.id });
  mocks.apply.mockResolvedValue({
    id: "ver_application",
    targetType: "developer",
    targetId: actor.id,
    status: "pending",
  });
  mocks.decide.mockResolvedValue({ id: "ver_application", status: "approved" });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("binds private reads to the current session and keeps history/organization queries separate", async () => {
  const response = await overview(request("GET", undefined, "?view=history&type=developer&page=2"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(mocks.overview).toHaveBeenCalledWith(actor, {
    view: "history",
    type: "developer",
    page: 2,
    query: "",
  });
  await targets(request("GET", undefined, "?q=Team&page=3"));
  expect(mocks.targets).toHaveBeenCalledWith(
    actor,
    expect.objectContaining({ query: "Team", page: 3 }),
  );
  await own(request());
  expect(mocks.ownProfile).toHaveBeenCalledWith(actor);
});
it("refuses a verification decision when the initiating session cookie is missing", async () => {
  const response = await decide(
    request("PATCH", decision, "", { cookie: "nexus_locale=ru" }),
    context,
  );
  expect(response.status).toBe(401);
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("blocks anonymous requests and forged/repeated/unbounded filters before service work", async () => {
  mocks.session.mockResolvedValue(null);
  expect((await overview(request())).status).toBe(401);
  expect((await decide(request("PATCH", decision), context)).status).toBe(401);
  mocks.session.mockResolvedValue(actor);
  for (const query of ["?requesterId=victim", "?page=1&page=2", "?page=10000", "?type=product"])
    expect((await overview(request("GET", undefined, query))).status).toBe(400);
  expect(mocks.overview).not.toHaveBeenCalled();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("normalizes saved fields and submits proof without accepting trust/role/scope injection", async () => {
  expect((await update(request("PATCH", profile))).status).toBe(200);
  expect(mocks.updateProfile).toHaveBeenCalledWith(actor, { ...profile, discordTag: "dev" });
  expect((await POST(request("POST", application))).status).toBe(201);
  expect(mocks.apply).toHaveBeenCalledWith(actor, { ...application, notes: "Project evidence" });
  expect(mocks.after).not.toHaveBeenCalled();
  for (const body of [
    { ...profile, verifiedDeveloper: true },
    { ...profile, reputationScore: 900 },
    { ...profile, actorId: "victim" },
  ])
    expect((await update(request("PATCH", body))).status).toBe(400);
  for (const body of [
    { ...application, requesterId: "victim" },
    { ...application, targetType: "server" },
    { ...application, proofUrl: "javascript:alert(1)" },
  ])
    expect((await POST(request("POST", body))).status).toBe(400);
  expect(mocks.updateProfile).toHaveBeenCalledTimes(1);
  expect(mocks.apply).toHaveBeenCalledTimes(1);
});
it("requires bounded same-site JSON for every mutation", async () => {
  for (const action of [
    (body: unknown, headers: Record<string, string>) => POST(request("POST", body, "", headers)),
    (body: unknown, headers: Record<string, string>) => update(request("PATCH", body, "", headers)),
    (body: unknown, headers: Record<string, string>) =>
      decide(request("PATCH", body, "", headers), context),
  ]) {
    expect((await action({}, { "sec-fetch-site": "cross-site" })).status).toBe(403);
    expect((await action({}, { "content-type": "text/plain" })).status).toBe(415);
    expect((await action({ notes: "x".repeat(40000) }, {})).status).toBe(413);
  }
  expect(mocks.apply).not.toHaveBeenCalled();
  expect(mocks.updateProfile).not.toHaveBeenCalled();
  expect(mocks.decide).not.toHaveBeenCalled();
});
it("confirms moderation results and rejects malformed decisions/id without writes", async () => {
  const response = await decide(request("PATCH", decision), context);
  expect(await response.json()).toEqual({ id: "ver_application", status: "approved" });
  expect(mocks.decide).toHaveBeenCalledWith(
    actor,
    "ver_application",
    {
      ...decision,
      reviewNotes: "Reviewed evidence",
    },
    "test",
  );
  expect(
    (await decide(request("PATCH", { ...decision, reviewerId: "admin" }), context)).status,
  ).toBe(400);
  expect(
    (await decide(request("PATCH", decision), { params: Promise.resolve({ id: "a/b" }) })).status,
  ).toBe(400);
  expect(mocks.decide).toHaveBeenCalledTimes(1);
});
it("returns localized current-authority, version conflict and uncertain-write errors", async () => {
  for (const [code, status] of [
    ["FORBIDDEN", 403],
    ["CONFLICT", 409],
    ["VERIFICATION_PROFILE_CHANGED", 409],
    ["VERIFICATION_SELF_REVIEW", 403],
  ] as const) {
    mocks.decide.mockRejectedValue(new AppError("private SQL details", status, code));
    const response = await decide(request("PATCH", decision), context);
    expect(response.status).toBe(status);
    expect(JSON.stringify(await response.json())).not.toContain("private SQL");
  }
  mocks.updateProfile.mockRejectedValue(new Error("private SQL"));
  const failure = await update(request("PATCH", profile));
  expect(failure.status).toBe(503);
  expect((await failure.json()).error).toMatch(/подтвердить/u);
});
it("rate-limits every read/write before service work", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  for (const response of [
    await own(request()),
    await overview(request()),
    await targets(request()),
    await POST(request("POST", application)),
    await update(request("PATCH", profile)),
    await decide(request("PATCH", decision), context),
  ])
    expect(response.status).toBe(429);
  for (const fn of [
    mocks.overview,
    mocks.targets,
    mocks.ownProfile,
    mocks.apply,
    mocks.updateProfile,
    mocks.decide,
  ])
    expect(fn).not.toHaveBeenCalled();
});
