import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({ trust: vi.fn(), team: vi.fn() }));
vi.mock("@nexus/db", () => ({
  publicContextTrustRepository: { page: mocks.trust },
  organizationTeamDirectoryRepository: { page: mocks.team },
  organizationWorkspaceRepository: {},
}));
import { publicContextTrustService as trust } from "../apps/web/src/lib/services/public-context-trust-service";
import { organizationTeamService as team } from "../apps/web/src/lib/services/organization-team-service";
import {
  parseContextKind,
  parseContextTrustQuery,
  contextTrustHref,
  publicContextTrustSchema,
} from "../apps/web/src/lib/public-context-trust-contract";
import {
  organizationTeamHref,
  organizationTeamPageSchema,
  parseOrganizationTeamQuery,
} from "../apps/web/src/lib/organization-team-contract";
import { confirmsOrganizationMemberMutation } from "../apps/web/src/lib/organization-member-confirmation";
import { contextTrustCopy } from "../apps/web/src/lib/public-context-trust-copy";
import { organizationTeamCopy } from "../apps/web/src/lib/organization-team-copy";
const time = "2026-10-11T00:00:00.123456Z",
  actor = { id: "actor", role: "admin" } as User;
const organization = {
  id: "org",
  ownerId: "owner",
  slug: "team",
  name: "Team",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  isVerified: false,
  updatedAt: new Date(time),
  createdAt: new Date(time),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.trust.mockResolvedValue({
    subject: {
      kind: "server",
      slug: "server",
      name: "Server",
      createdAt: new Date(time),
      verified: false,
      publications: 0,
      servers: null,
      organization: { slug: "team", name: "Team", verified: true, ownerId: "private" },
      ownershipKind: "organization",
      id: "private",
      endpoint: "private",
    },
    items: [
      { key: "b".repeat(32), approvedAt: new Date(time), proofUrl: "private", id: "request" },
    ],
    hasMore: true,
    context: "a".repeat(64),
    nextCursor: { createdAt: time, id: "b".repeat(32) },
  });
  mocks.team.mockResolvedValue({
    organization,
    role: "member",
    owner: {
      id: "owner",
      username: "boss",
      displayName: "Boss",
      avatarUrl: "javascript:bad",
      email: "private",
    },
    members: [
      {
        id: "reader",
        username: "reader",
        displayName: "Reader",
        avatarUrl: null,
        role: "admin",
        managesServers: false,
        effectiveServerAccess: true,
        joinedAt: new Date(time),
        membershipId: "private",
        permissions: ["commerce"],
        email: "private",
      },
    ],
    hasMore: true,
    context: "a".repeat(64),
    nextCursor: { createdAt: time, id: "membership" },
  });
});
it.each(["?type=server", "?includeProof=true", "?cursor=", "?cursor=bad", "?cursor=a&cursor=b"])(
  "rejects injected public approval filters %s",
  (query) => {
    expect(parseContextTrustQuery(new URLSearchParams(query))).toBeNull();
  },
);
it.each([
  "?role=owner",
  "?access=commerce",
  "?role=admin&role=member",
  "?q=%0A",
  `?q=${"x".repeat(121)}`,
  "?actorId=other",
  "?page=2",
  "?cursor=bad",
])("rejects malformed/private team filters %s", (query) => {
  expect(parseOrganizationTeamQuery(new URLSearchParams(query))).toBeNull();
});
it("accepts only supported public context kinds and durable encoded links", () => {
  expect(parseContextKind("organizations")).toBe("organization");
  expect(parseContextKind("servers")).toBe("server");
  expect(parseContextKind("users")).toBeNull();
  expect(contextTrustHref("server", "my-server", "a&b")).toBe(
    "/servers/my-server/trust?cursor=a%26b",
  );
  const url = new URL(
    organizationTeamHref("org", { query: "%_", role: "other", access: "no" }, "a&b", true),
    "https://nexus.test",
  );
  expect(url.pathname).toBe("/api/workspace/organizations/org/team");
  expect(url.searchParams.get("q")).toBe("%_");
  expect(url.searchParams.get("cursor")).toBe("a&b");
});
it("returns only public verification fields, separately retaining historical dates and exact cursor precision", async () => {
  const result = await trust.page("server", "server");
  expect(publicContextTrustSchema.safeParse(result).success).toBe(true);
  expect(result.subject.verified).toBe(false);
  expect(JSON.stringify(result)).not.toMatch(/ownerId|private|proofUrl|endpoint|request/u);
  const parsed = parseContextTrustQuery(new URLSearchParams({ cursor: result.nextCursor ?? "" }));
  expect(parsed?.cursor).toMatchObject({
    createdAt: time,
    id: "b".repeat(32),
    context: "a".repeat(64),
    version: 1,
  });
  expect(
    publicContextTrustSchema.safeParse({
      ...result,
      subject: { ...result.subject, servers: { total: 0, verified: 2 } },
    }).success,
  ).toBe(false);
});
it.each(["../hidden", "SERVER", "", "x".repeat(201)])(
  "rejects invalid public slug %s before SQL",
  async (slug) => {
    await expect(trust.page("server", slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.trust).not.toHaveBeenCalled();
  },
);
it("projects a narrow team DTO using only session identity, safe media and exact membership cursor", async () => {
  const result = await team.page("org", actor, { query: "Lua", role: "admin", access: "yes" });
  expect(mocks.team).toHaveBeenCalledWith("org", "actor", {
    query: "Lua",
    role: "admin",
    access: "yes",
  });
  expect(organizationTeamPageSchema.safeParse(result).success).toBe(true);
  expect(result.owner?.avatarUrl).toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/permissions|email|private|membershipId/u);
  expect(
    parseOrganizationTeamQuery(new URLSearchParams({ cursor: result.nextCursor ?? "" }))?.cursor
      ?.createdAt,
  ).toBe(time);
  expect(organizationTeamPageSchema.safeParse({ ...result, hasMore: false }).success).toBe(false);
});
it("rejects invalid organization IDs before authority lookup", async () => {
  await expect(team.page("../org", actor, { query: "" })).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(mocks.team).not.toHaveBeenCalled();
});
it("normalizes team search and keeps role/access selection without cursor", () => {
  expect(
    parseOrganizationTeamQuery(new URLSearchParams("q=+Lua+&role=developer&access=yes")),
  ).toEqual({ query: "Lua", role: "developer", access: "yes", cursor: undefined });
});
const previous = { ...organization, updatedAt: new Date(time).toISOString() },
  committed = { ...previous, updatedAt: "2026-10-11T00:00:01.000Z" };
const committedProjection = {
  id: committed.id,
  ownerId: committed.ownerId,
  slug: committed.slug,
  name: committed.name,
  description: committed.description,
  logoUrl: committed.logoUrl,
  websiteUrl: committed.websiteUrl,
  isVerified: committed.isVerified,
  updatedAt: committed.updatedAt,
};
it("confirms only the exact member and changed same-owner organization revision", () => {
  expect(
    confirmsOrganizationMemberMutation(
      { organization: committed, userId: "reader", role: "developer", managesServers: true },
      previous,
      { userId: "reader", role: "developer", managesServers: true },
    ),
  ).toEqual(committedProjection);
  expect(
    confirmsOrganizationMemberMutation(
      {
        organization: committed,
        member: { username: "reader", role: "member", managesServers: false },
      },
      previous,
      { username: "reader", role: "member", managesServers: false },
      true,
    ),
  ).toEqual(committedProjection);
});
it.each([
  { organization: previous, userId: "reader", removed: true },
  { organization: { ...committed, ownerId: "other" }, userId: "reader", removed: true },
  { organization: committed, userId: "other", removed: true },
  { organization: committed, userId: "reader", removed: false },
  {},
  null,
])("rejects stale, foreign or unconfirmed removal acknowledgement %j", (value) => {
  expect(
    confirmsOrganizationMemberMutation(value, previous, { userId: "reader", removed: true }),
  ).toBeNull();
});
it("keeps complete RU/EN copy", () => {
  expect(Object.keys(contextTrustCopy("ru"))).toEqual(Object.keys(contextTrustCopy("en")));
  expect(Object.keys(organizationTeamCopy("ru"))).toEqual(Object.keys(organizationTeamCopy("en")));
});
