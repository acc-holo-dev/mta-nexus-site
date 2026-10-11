import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({ state: vi.fn(), set: vi.fn(), page: vi.fn(), trust: vi.fn() }));
vi.mock("@nexus/db", () => ({
  contentReactionsRepository: { state: mocks.state, set: mocks.set, page: mocks.page },
  publicUserTrustRepository: { find: mocks.trust },
}));
import { contentReactionService as service } from "../apps/web/src/lib/services/content-reaction-service";
import { publicUserTrustService as trust } from "../apps/web/src/lib/services/public-user-trust-service";
import { publicUserTrustSchema } from "../apps/web/src/lib/public-user-trust-contract";
import { parseReactionPage } from "../apps/web/src/lib/content-reaction-contract";
const actor = { id: "actor", role: "user" } as User;
const time = "2026-10-11T00:00:00.123456Z";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.set.mockResolvedValue({
    contentId: "content",
    slug: "private",
    counts: { helpful: 99 },
    changed: true,
  });
  mocks.page.mockResolvedValue({
    items: [
      {
        contentId: "content",
        emoji: "❤️",
        reactedAt: new Date(time),
        title: null,
        slug: null,
        type: null,
        extra: "private",
      },
    ],
    hasMore: true,
    nextCursor: { createdAt: time, id: "content" },
  });
  mocks.trust.mockResolvedValue({
    username: "writer",
    displayName: "Writer",
    avatarUrl: "javascript:bad",
    joinedAt: new Date(time),
    identityVerified: true,
    developerVerified: false,
    identityApprovalAt: time,
    developerApprovalAt: time,
    servers: 2,
    verifiedServers: 1,
    organizations: 1,
    verifiedOrganizations: 0,
    publications: null,
    email: "private",
    reputationScore: 100,
    reviewNotes: "secret",
  });
});
it("uses session identity and generated IDs for explicit desired-state writes", async () => {
  await service.set(actor, "guide", "thanks");
  expect(mocks.set).toHaveBeenCalledWith({
    actorId: "actor",
    slug: "guide",
    reaction: "thanks",
    reactionId: expect.stringMatching(/^rea_[a-f0-9]{24}$/u),
    auditId: expect.stringMatching(/^aud_[a-f0-9]{24}$/u),
  });
});
it.each(["../draft", "GUIDE", "", "x".repeat(201)])(
  "rejects invalid publication %s before querying",
  async (slug) => {
    await expect(service.state(slug)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(service.set(actor, slug, null)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mocks.state).not.toHaveBeenCalled();
    expect(mocks.set).not.toHaveBeenCalled();
  },
);
it("makes own cleanup idempotent without revealing any private target metadata", async () => {
  expect(await service.remove(actor, "content")).toEqual({ contentId: "content", removed: true });
  expect(mocks.set).toHaveBeenCalledWith(
    expect.objectContaining({ actorId: "actor", contentId: "content", reaction: null }),
  );
  await expect(service.remove(actor, "../other")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
it("preserves exact cursor time and returns a narrow personal DTO", async () => {
  const page = await service.page(actor, { query: "Lua", reaction: "thanks" });
  expect(page.items[0]).toEqual({
    contentId: "content",
    reaction: "thanks",
    reactedAt: new Date(time).toISOString(),
    title: null,
    slug: null,
    type: null,
  });
  expect(JSON.parse(page.nextCursor ?? "")).toMatchObject({
    createdAt: time,
    id: "content",
    version: 1,
    context: expect.stringMatching(/^[a-f0-9]{64}$/u),
  });
});
it.each([
  { actor: { ...actor, id: "other" }, query: "Lua", reaction: "thanks" },
  { actor, query: "Other", reaction: "thanks" },
  { actor, query: "Lua", reaction: "helpful" },
])("rejects cursor replay in another account/filter %j", async (input) => {
  const first = await service.page(actor, { query: "Lua", reaction: "thanks" });
  const filters = parseReactionPage(
    new URLSearchParams({ q: "Lua", reaction: "thanks", cursor: first.nextCursor ?? "" }),
  );
  if (!filters) throw new Error("Bad cursor fixture");
  mocks.page.mockClear();
  await expect(
    service.page(input.actor, {
      ...filters,
      query: input.query,
      reaction: input.reaction as "thanks" | "helpful",
    }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(mocks.page).not.toHaveBeenCalled();
});
it("accepts the same cursor with the same normalized private filters", async () => {
  const first = await service.page(actor, { query: "Lua" });
  const filters = parseReactionPage(
    new URLSearchParams({ q: " Lua ", cursor: first.nextCursor ?? "" }),
  );
  if (!filters) throw new Error("Bad cursor fixture");
  await expect(service.page(actor, filters)).resolves.toHaveProperty("hasMore", true);
});
it("projects current trust only, masking unsafe media, inactive approval dates and private activity", async () => {
  const result = await trust.get("writer");
  expect(publicUserTrustSchema.safeParse(result).success).toBe(true);
  expect(result.developer).toEqual({ verified: false, latestRecordedApprovalAt: null });
  expect(result.identity).toEqual({
    verified: true,
    latestRecordedApprovalAt: new Date(time).toISOString(),
  });
  expect(result.publications).toBeNull();
  expect(result.user.avatarUrl).toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/reputationScore|email|reviewNotes|secret/u);
});
it("reports missing/invalid public profiles without requesting private models", async () => {
  await expect(trust.get("../other")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.trust).not.toHaveBeenCalled();
  mocks.trust.mockResolvedValue(null);
  await expect(trust.get("missing")).rejects.toMatchObject({ code: "NOT_FOUND" });
});
