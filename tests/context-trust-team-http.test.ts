import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  trust: vi.fn(),
  team: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/public-context-trust-service", () => ({
  publicContextTrustService: { page: mocks.trust },
}));
vi.mock("../apps/web/src/lib/services/organization-team-service", () => ({
  organizationTeamService: { page: mocks.team },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
vi.mock("../apps/web/src/lib/request-client-ip", () => ({
  getTrustedRequestIp: () => "trusted-ip",
}));
import { GET as trust } from "../apps/web/src/app/api/trust/[kind]/[slug]/route";
import { GET as team } from "../apps/web/src/app/api/workspace/organizations/[id]/team/route";
const actor = { id: "actor", role: "admin" },
  organization = { params: Promise.resolve({ id: "org" }) },
  context = (kind = "servers") => ({ params: Promise.resolve({ kind, slug: "server" }) });
const request = (query = "") =>
  new NextRequest(`https://nexus.test/api${query}`, {
    headers: { cookie: "nexus_session=test;nexus_locale=ru" },
  });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.trust.mockResolvedValue({ items: [] });
  mocks.team.mockResolvedValue({ members: [] });
});
it.each(["organizations", "servers"])(
  "serves public %s trust with no session, no-store and trusted-IP rate limit",
  async (kind) => {
    const response = await trust(request(), context(kind));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.rate).toHaveBeenCalledWith("search", "trusted-ip");
    expect(mocks.trust).toHaveBeenCalledWith(
      kind === "organizations" ? "organization" : "server",
      "server",
      {},
    );
  },
);
it("requires a session and scopes private team queries to it with private caching", async () => {
  const response = await team(request("?q=Lua&role=developer&access=yes"), organization);
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.team).toHaveBeenCalledWith("org", actor, {
    query: "Lua",
    role: "developer",
    access: "yes",
    cursor: undefined,
  });
  expect(mocks.rate).toHaveBeenCalledWith("search", "actor");
  mocks.session.mockResolvedValue(null);
  expect((await team(request(), organization)).status).toBe(401);
});
it.each(["?includeProof=true", "?type=user", "?cursor=bad"])(
  "rejects public private/malformed filters %s",
  async (query) => {
    expect((await trust(request(query), context())).status).toBe(400);
    expect(mocks.trust).not.toHaveBeenCalled();
  },
);
it.each([
  "?actorId=other",
  "?role=owner",
  "?role=admin&role=member",
  "?access=commerce",
  "?page=2",
])("rejects unsupported team filter %s", async (query) => {
  expect((await team(request(query), organization)).status).toBe(400);
  expect(mocks.team).not.toHaveBeenCalled();
});
it("rejects unsupported public target kinds without reading trust", async () => {
  expect((await trust(request(), context("users"))).status).toBe(404);
  expect(mocks.trust).not.toHaveBeenCalled();
});
it("returns safe localized missing, forbidden, cursor and infrastructure errors", async () => {
  mocks.trust.mockRejectedValue(new AppError("hidden server endpoint", 404, "NOT_FOUND"));
  expect((await trust(request(), context())).status).toBe(404);
  mocks.team.mockRejectedValue(new AppError("private team", 403, "FORBIDDEN"));
  expect((await team(request(), organization)).status).toBe(403);
  mocks.team.mockRejectedValue(new AppError("private context", 400, "INVALID_CURSOR"));
  const bad = await team(request(), organization);
  expect(bad.status).toBe(400);
  expect((await bad.json()).error).toMatch(/страница команды/u);
  mocks.trust.mockRejectedValue(new Error("secret proof SQL"));
  const failed = await trust(request(), context());
  expect(failed.status).toBe(503);
  const value = await failed.json();
  expect(value.error).toMatch(/Не удалось/u);
  expect(JSON.stringify(value)).not.toContain("secret");
});
it("enforces both public and private read limits", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await trust(request(), context())).status).toBe(429);
  expect((await team(request(), organization)).status).toBe(429);
  expect(mocks.trust).not.toHaveBeenCalled();
  expect(mocks.team).not.toHaveBeenCalled();
});
