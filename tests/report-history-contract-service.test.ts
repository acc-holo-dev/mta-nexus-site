import { AppError, type User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  discussionReports: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
  detail: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  communityModerationWorkspaceRepository: state,
  discussionManagementRepository: {},
  authorContentRepository: state,
  organizationContentRepository: {},
  contentRepository: {},
  serverContentRepository: {},
  communityReportsRepository: state,
}));
vi.mock("../apps/web/src/lib/services/content-service", () => ({ contentService: {} }));

import {
  discussionReportsHref,
  discussionReportsPageSchema,
  parseDiscussionReportsQuery,
} from "../apps/web/src/lib/discussion-reports-contract";
import { discussionReportsCopy } from "../apps/web/src/lib/discussion-reports-copy";
import {
  confirmedOrganizationPublicationRestore,
  organizationPublicationHistorySchema,
} from "../apps/web/src/lib/organization-publication-history-contract";
import { organizationPublicationHistoryCopy } from "../apps/web/src/lib/organization-publication-history-copy";
import { communityModerationService as moderation } from "../apps/web/src/lib/services/community-moderation-service";
import { communityReportService as reports } from "../apps/web/src/lib/services/community-report-service";
import { organizationContentService as organizations } from "../apps/web/src/lib/services/organization-content-service";

const time = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.123457Z",
  actor = { id: "actor", role: "moderator" } as User;
const publication = {
  id: "post",
  title: "Private",
  slug: "guide",
  type: "post",
  status: "archived",
};
beforeEach(() => vi.clearAllMocks());
it("accepts only bounded related-report filters and complete microsecond cursors", () => {
  expect(
    parseDiscussionReportsQuery(new URLSearchParams("q= word &view=history&type=spam")),
  ).toMatchObject({ query: "word", view: "history", type: "spam" });
  for (const raw of [
    "q=a&q=b",
    "view=all",
    "type=resource",
    "actorId=foreign",
    "q=%00",
    `q=${"x".repeat(101)}`,
    "cursor=broken",
  ])
    expect(parseDiscussionReportsQuery(new URLSearchParams(raw))).toBeNull();
  const cursor = { id: "report", createdAt: time, context: "a".repeat(64), version: 1 };
  expect(
    parseDiscussionReportsQuery(new URLSearchParams({ cursor: JSON.stringify(cursor) }))?.cursor,
  ).toEqual(cursor);
  expect(
    parseDiscussionReportsQuery(
      new URLSearchParams({
        cursor: JSON.stringify({ ...cursor, createdAt: time.replace("123456", "123") }),
      }),
    ),
  ).toBeNull();
  expect(
    discussionReportsHref(
      "post /",
      "comment/",
      { query: "%_", view: "history", type: "spam" },
      "token",
    ),
  ).toBe(
    "/admin/community/post%20%2F/discussion/comment%2F/reports?q=%25_&view=history&type=spam&cursor=token",
  );
});
it("rechecks service authority and projects narrow report cards without reporter, notes, raw context or audit details", async () => {
  const filters = { query: "", view: "pending" as const, type: undefined, cursor: undefined };
  state.discussionReports.mockResolvedValue({
    publication,
    commentId: "comment",
    removed: true,
    items: [
      {
        id: "report",
        type: "spam",
        reason: "Reason",
        status: "open",
        createdAt: new Date(time),
        resolvedAt: null,
        reporterId: "secret",
        moderatorNotes: "private",
      },
    ],
    hasMore: true,
    nextCursor: { id: "report", createdAt: time },
    context: "a".repeat(64),
  });
  await expect(
    moderation.discussionReports({ ...actor, role: "user" }, "post", "comment", filters),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.discussionReports).not.toHaveBeenCalled();
  const result = await moderation.discussionReports(actor, "post", "comment", filters);
  expect(discussionReportsPageSchema.safeParse(result).success).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/secret|private|moderatorNotes|reporterId/u);
  expect(state.discussionReports).toHaveBeenCalledWith("actor", "post", "comment", filters);
  for (const id of ["../foreign", "", "x".repeat(129)])
    await expect(moderation.discussionReports(actor, id, "comment", filters)).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
});
it("projects team identity on shared history while keeping moderator identity and internal details private", async () => {
  const event = {
    id: "event",
    createdAt: time,
    from: "archived",
    to: "draft",
    actorUsername: "editor",
    actorName: "Editor",
    email: "private",
    details: { notes: "private" },
    actorId: "private",
  };
  state.history.mockResolvedValue({
    organization: { id: "org", name: "Team" },
    item: { id: "post", title: "Title", status: "draft", revision: next, recoverable: false },
    olderCursor: null,
    events: [
      { ...event, action: "content.restored_by_organization" },
      { ...event, id: "staff", action: "content.archived", actorUsername: "PRIVATE_MODERATOR" },
    ],
  });
  const result = await organizations.history("org", actor, "post", { cursor: undefined });
  expect(state.history).toHaveBeenCalledWith("post", "actor", undefined, "org");
  expect(organizationPublicationHistorySchema.safeParse(result).success).toBe(true);
  expect(result.events[0]).toMatchObject({
    kind: "restored",
    actor: "team",
    identity: { username: "editor", name: "Editor" },
  });
  expect(result.events[1]).toMatchObject({ actor: "moderation", identity: null });
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_MODERATOR|email|notes|actorId|details/u);
  state.history.mockRejectedValueOnce(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(
    organizations.history("org", actor, "post", { cursor: undefined }),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
});
it("uses server-generated scoped restoration audit and rejects authority fields or invalid scope before storage", async () => {
  const ack = { id: "post", organizationId: "org", status: "draft", revision: next };
  state.restore.mockResolvedValue(ack);
  expect(await organizations.restore("org", actor, "post", { expectedRevision: time })).toEqual(
    ack,
  );
  expect(state.restore).toHaveBeenCalledWith(
    "post",
    "actor",
    time,
    expect.objectContaining({
      actorId: "actor",
      actorType: "user",
      action: "content.restored_by_organization",
      targetId: "post",
    }),
    "org",
  );
  expect(confirmedOrganizationPublicationRestore(ack, "post", "org", time)).toBe(true);
  for (const reply of [
    { ...ack, organizationId: "foreign" },
    { ...ack, id: "foreign" },
    { ...ack, status: "published" },
    { ...ack, revision: time },
    { ...ack, body: "private" },
    null,
  ])
    expect(confirmedOrganizationPublicationRestore(reply, "post", "org", time)).toBe(false);
  await expect(
    organizations.restore("org", actor, "post", {
      expectedRevision: time,
      organizationId: "foreign",
    }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    organizations.restore("../foreign", actor, "post", { expectedRevision: time }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.restore).toHaveBeenCalledTimes(1);
});
it("adds discussion deep links only to staff report details, including retained removed targets", async () => {
  state.detail.mockResolvedValue({
    id: "report",
    type: "spam",
    targetType: "comment",
    targetId: "comment",
    reason: "Reason",
    evidenceUrls: [],
    status: "open",
    createdAt: new Date(time),
    resolvedAt: null,
    target: null,
    moderationContentId: "post",
    reporterId: "reporter",
    moderatorNotes: "Private",
  });
  expect((await reports.detail(actor, "report", true)).moderationHref).toBe(
    "/admin/community/post/discussion/comment",
  );
  expect(await reports.detail(actor, "report", false)).not.toHaveProperty("moderationHref");
});
it("provides all shared history and related-report actions in both locales", () => {
  expect(Object.keys(discussionReportsCopy("ru"))).toEqual(
    Object.keys(discussionReportsCopy("en")),
  );
  expect(Object.keys(organizationPublicationHistoryCopy("ru"))).toEqual(
    Object.keys(organizationPublicationHistoryCopy("en")),
  );
});

it("preserves a bounded Unicode report preview without splitting surrogate pairs", async () => {
  state.detail.mockResolvedValue({
    id: "report",
    type: "spam",
    targetType: "comment",
    targetId: "comment",
    reason: "Reason",
    evidenceUrls: [],
    status: "open",
    createdAt: new Date(time),
    resolvedAt: null,
    moderationContentId: "post",
    reporterId: "reporter",
    moderatorNotes: null,
    target: {
      kind: "comment",
      id: "comment",
      slug: "guide",
      title: "Title",
      text: "🙂".repeat(5000),
      truncated: false,
      author: "writer",
      status: "published",
      revision: "a".repeat(64),
    },
  });
  const detail = await reports.detail(actor, "report", true);
  expect(detail.target?.text).toBe("🙂".repeat(5000));
});
