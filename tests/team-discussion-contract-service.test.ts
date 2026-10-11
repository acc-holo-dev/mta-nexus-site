import { AppError, type User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  previewMembers: vi.fn(),
  batchMembers: vi.fn(),
  discussion: vi.fn(),
  discussionDetail: vi.fn(),
  mutate: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  organizationWorkspaceRepository: state,
  communityModerationWorkspaceRepository: state,
  discussionManagementRepository: state,
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));

import {
  confirmsModeratedDiscussionRemoval,
  moderatedDiscussionDetailSchema,
  moderatedDiscussionHref,
  moderatedDiscussionRemoveSchema,
  parseModeratedDiscussionQuery,
} from "../apps/web/src/lib/moderated-discussion-contract";
import { moderatedDiscussionCopy } from "../apps/web/src/lib/moderated-discussion-copy";
import {
  confirmsOrganizationBatchCommand,
  confirmsOrganizationBatchPreview,
  organizationBatchCommandInput,
  organizationBatchPreviewInput,
} from "../apps/web/src/lib/organization-batch-contract";
import { organizationBatchCopy } from "../apps/web/src/lib/organization-batch-copy";
import { communityModerationService as moderation } from "../apps/web/src/lib/services/community-moderation-service";
import { organizationWorkspaceService as teams } from "../apps/web/src/lib/services/organization-workspace-service";

const time = "2026-10-11T00:00:00.000Z",
  later = "2026-10-11T00:00:00.001Z",
  version = "a".repeat(64);
const organization = {
  id: "org",
  slug: "team",
  name: "Team",
  description: "",
  logoUrl: "",
  websiteUrl: "",
  ownerId: "owner",
  isVerified: false,
  updatedAt: time,
};
const input = {
  userIds: ["member"],
  change: { action: "role", role: "developer" } as const,
  expectedUpdatedAt: time,
};
const preview = {
  organizationId: "org",
  expectedUpdatedAt: time,
  previewRevision: version,
  changedCount: 1,
  members: [
    {
      userId: "member",
      username: "member",
      displayName: "Member",
      before: { role: "member", managesServers: false, effectiveServerAccess: false },
      after: { role: "developer", managesServers: false, effectiveServerAccess: false },
      changed: true,
    },
  ],
};
const actor = { id: "owner", role: "moderator" } as User;
beforeEach(() => {
  vi.clearAllMocks();
  state.previewMembers.mockResolvedValue(preview);
  state.batchMembers.mockResolvedValue({
    organization: { ...organization, updatedAt: new Date(later) },
    changedUserIds: ["member"],
    previewRevision: version,
  });
});
it.each([[], ["a", "a"], Array.from({ length: 21 }, (_, i) => `u-${i}`), ["../foreign"]])(
  "rejects invalid bulk selection %j",
  (userIds) => {
    expect(organizationBatchPreviewInput.safeParse({ ...input, userIds }).success).toBe(false);
  },
);
it.each([
  { action: "role", role: "owner" },
  { action: "server_access", enabled: "true" },
  { action: "remove", role: "admin" },
  { action: "commercial_grants", enabled: true },
])("rejects unauthorized action fields %j", (change) => {
  expect(organizationBatchPreviewInput.safeParse({ ...input, change }).success).toBe(false);
});
it("requires a reviewed token and validates exact changed identities, scope, version and access", () => {
  expect(organizationBatchCommandInput.safeParse(input).success).toBe(false);
  expect(confirmsOrganizationBatchPreview(preview, "org", input)).toEqual(preview);
  for (const value of [
    { ...preview, organizationId: "other" },
    { ...preview, expectedUpdatedAt: later },
    { ...preview, changedCount: 0 },
    { ...preview, permissions: ["commercial"] },
    {
      ...preview,
      members: [
        {
          ...preview.members[0],
          after: { ...preview.members[0].after, effectiveServerAccess: true },
        },
      ],
    },
    { ...preview, members: [{ ...preview.members[0], userId: "foreign" }] },
  ])
    expect(confirmsOrganizationBatchPreview(value, "org", input)).toBeNull();
  const ack = {
    organization: { ...organization, updatedAt: later },
    changedUserIds: ["member"],
    previewRevision: version,
  };
  expect(confirmsOrganizationBatchCommand(ack, organization, preview)?.updatedAt).toBe(later);
  for (const value of [
    { ...ack, changedUserIds: ["foreign"] },
    { ...ack, previewRevision: "b".repeat(64) },
    { ...ack, organization },
    { ...ack, organization: { ...ack.organization, ownerId: "foreign" } },
    { ...ack, changedUserIds: ["member", "member"] },
  ])
    expect(confirmsOrganizationBatchCommand(value, organization, preview)).toBeNull();
});
it("parses service input, delegates authority to the repository and gives every selected subject a unique audit", async () => {
  await teams.previewMembers("org", input, actor);
  expect(state.previewMembers).toHaveBeenCalledWith("org", "owner", {
    ...input,
    expectedUpdatedAt: new Date(time),
  });
  const result = await teams.batchMembers("org", { ...input, previewRevision: version }, actor);
  expect(result.organization.updatedAt).toBe(later);
  const args = state.batchMembers.mock.calls[0];
  expect(args.slice(0, 2)).toEqual(["org", "owner"]);
  expect(args[3][0]).toMatchObject({
    actorId: "owner",
    targetId: "org",
    targetType: "organization",
    actorType: "user",
  });
  await expect(
    teams.batchMembers("org", { ...input, previewRevision: version, actorId: "foreign" }, actor),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.batchMembers).toHaveBeenCalledTimes(1);
});
it("limits search and cursor grammar to discussion filters and preserves exact scope in links", () => {
  expect(parseModeratedDiscussionQuery(new URLSearchParams("q= word &author=Alice"))).toMatchObject(
    { query: "word", author: "Alice" },
  );
  for (const raw of [
    "q=a&q=b",
    "status=draft",
    "type=resource",
    "actorId=foreign",
    "author=../user",
    `q=${"x".repeat(101)}`,
    "q=%00",
    "cursor=broken",
  ])
    expect(parseModeratedDiscussionQuery(new URLSearchParams(raw))).toBeNull();
  expect(moderatedDiscussionHref("id /", { query: "%_", author: "Alice" }, "cursor")).toBe(
    "/admin/community/id%20%2F/discussion?q=%25_&author=Alice&cursor=cursor",
  );
  expect(
    moderatedDiscussionRemoveSchema.safeParse({ expectedRevision: version, reason: " " }).success,
  ).toBe(false);
  expect(
    moderatedDiscussionRemoveSchema.safeParse({
      expectedRevision: version,
      reason: "Reason",
      text: "replacement",
    }).success,
  ).toBe(false);
});
it("enforces moderator service roles and emits strict scoped removals", async () => {
  state.mutate.mockResolvedValue({ contentId: "post", commentId: "comment", removed: true });
  await expect(
    moderation.removeDiscussion({ ...actor, role: "user" }, "post", "comment", {
      expectedRevision: version,
      reason: "Reason",
    }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.mutate).not.toHaveBeenCalled();
  const result = await moderation.removeDiscussion(actor, "post", "comment", {
    expectedRevision: version,
    reason: "  Reviewed reason  ",
  });
  expect(state.mutate).toHaveBeenCalledWith(
    expect.objectContaining({
      actorId: "owner",
      contentId: "post",
      commentId: "comment",
      moderationWorkspace: true,
      reason: "Reviewed reason",
      expectedRevision: version,
    }),
  );
  expect(confirmsModeratedDiscussionRemoval(result, "post", "comment")).toBe(true);
  expect(
    confirmsModeratedDiscussionRemoval({ ...result, commentId: "foreign" }, "post", "comment"),
  ).toBe(false);
  expect(
    confirmsModeratedDiscussionRemoval({ ...result, text: "private text" }, "post", "comment"),
  ).toBe(false);
});
it("whitelists discussion detail and activity without raw audit fields or text digests", async () => {
  state.discussionDetail.mockResolvedValue({
    publication: { id: "post", title: "Private", slug: "guide", type: "post", status: "archived" },
    comment: {
      id: "comment",
      text: "Saved text",
      truncated: false,
      revision: version,
      digest: "private",
      createdAt: new Date(time),
      username: "writer",
      name: "Writer",
      parent: null,
      email: "secret",
    },
    history: [
      {
        id: "event",
        action: "content.comment_removed",
        moderator: true,
        reason: "Reason",
        createdAt: new Date(time),
        details: { secret: "private" },
        actorId: "private",
      },
    ],
    hasMore: false,
    nextCursor: null,
    context: version,
  });
  const result = await moderation.discussionDetail(actor, "post", "comment");
  expect(moderatedDiscussionDetailSchema.safeParse(result).success).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/digest|email|secret|actorId|details/u);
  state.discussionDetail.mockRejectedValue(new AppError("Role revoked", 403, "FORBIDDEN"));
  await expect(moderation.discussionDetail(actor, "post", "comment")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("provides matching RU/EN keys for every new action and message", () => {
  expect(Object.keys(organizationBatchCopy("ru"))).toEqual(
    Object.keys(organizationBatchCopy("en")),
  );
  expect(Object.keys(moderatedDiscussionCopy("ru"))).toEqual(
    Object.keys(moderatedDiscussionCopy("en")),
  );
});
