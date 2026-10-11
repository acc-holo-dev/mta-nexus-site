import { AppError, type User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  previewDiscussionBatch: vi.fn(),
  decideDiscussionBatch: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  communityReportsRepository: state,
  authorContentRepository: state,
  serverContentRepository: {},
  organizationContentRepository: {},
  contentRepository: {},
}));

import {
  confirmsReportBatchCommand,
  confirmsReportBatchPreview,
  reportBatchCommandInput,
  reportBatchPreviewInput,
} from "../apps/web/src/lib/report-batch-contract";
import { reportBatchCopy } from "../apps/web/src/lib/report-batch-copy";
import {
  confirmedServerPublicationRestore,
  serverPublicationHistorySchema,
} from "../apps/web/src/lib/server-publication-history-contract";
import { serverPublicationHistoryCopy } from "../apps/web/src/lib/server-publication-history-copy";
import { communityReportService as reports } from "../apps/web/src/lib/services/community-report-service";
import { serverContentService as servers } from "../apps/web/src/lib/services/server-content-service";

const actor = { id: "staff", role: "moderator" } as User,
  time = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.123457Z",
  token = "a".repeat(64);
const input = {
  items: [{ id: "report", expectedStatus: "open" as const }],
  action: "resolve" as const,
  notes: "Recorded reason",
};
const preview = {
  contentId: "post",
  commentId: "comment",
  publication: { id: "post", title: "Title", status: "archived" },
  comment: { id: "comment", text: "Complete review", truncated: false, revision: token },
  action: "resolve",
  notes: input.notes,
  previewRevision: token,
  items: [
    {
      id: "report",
      type: "spam",
      reason: "Reason",
      createdAt: time,
      before: "open",
      after: "resolved",
    },
  ],
};
beforeEach(() => vi.clearAllMocks());
it.each([
  [],
  [
    { id: "a", expectedStatus: "open" },
    { id: "a", expectedStatus: "open" },
  ],
  Array.from({ length: 21 }, (_, i) => ({ id: `r-${i}`, expectedStatus: "open" })),
  [{ id: "../foreign", expectedStatus: "open" }],
  [{ id: "a", expectedStatus: "resolved" }],
])("rejects invalid selected reports %j", (items) => {
  expect(reportBatchPreviewInput.safeParse({ ...input, items }).success).toBe(false);
});
it.each([
  { action: "remove_comment" },
  { action: "review", items: [{ id: "report", expectedStatus: "under_review" }] },
  { notes: " " },
  { actorId: "foreign" },
  { previewRevision: token },
])("rejects unreviewable preview %j", (fields) => {
  expect(reportBatchPreviewInput.safeParse({ ...input, ...fields }).success).toBe(false);
});
it("requires reviewed tokens and exact preview scope, identities, states and notes", () => {
  expect(reportBatchCommandInput.safeParse(input).success).toBe(false);
  expect(reportBatchCommandInput.safeParse({ ...input, previewRevision: token }).success).toBe(
    true,
  );
  expect(confirmsReportBatchPreview(preview, "post", "comment", input)).toEqual(preview);
  for (const reply of [
    { ...preview, contentId: "foreign" },
    { ...preview, commentId: "foreign" },
    { ...preview, publication: { ...preview.publication, id: "foreign" } },
    { ...preview, notes: "Different reason" },
    { ...preview, comment: { ...preview.comment, id: "foreign" } },
    { ...preview, items: [{ ...preview.items[0], before: "under_review" }] },
    { ...preview, items: [{ ...preview.items[0], after: "dismissed" }] },
    { ...preview, items: [{ ...preview.items[0], id: "foreign" }] },
    { ...preview, reporterId: "private" },
  ])
    expect(confirmsReportBatchPreview(reply, "post", "comment", input)).toBeNull();
});
it("binds command acknowledgement to the exact reviewed result and excludes private extra fields", () => {
  const reviewed = confirmsReportBatchPreview(preview, "post", "comment", input);
  if (!reviewed) throw Error("Invalid fixture");
  const ack = {
    contentId: "post",
    commentId: "comment",
    action: "resolve",
    previewRevision: token,
    items: [{ id: "report", status: "resolved" }],
  };
  expect(confirmsReportBatchCommand(ack, "post", "comment", reviewed)).toBe(true);
  for (const reply of [
    { ...ack, contentId: "foreign" },
    { ...ack, commentId: "foreign" },
    { ...ack, previewRevision: "b".repeat(64) },
    { ...ack, action: "dismiss" },
    { ...ack, items: [{ id: "foreign", status: "resolved" }] },
    { ...ack, items: [{ id: "report", status: "dismissed" }] },
    { ...ack, items: [...ack.items, ...ack.items] },
    { ...ack, items: [{ ...ack.items[0], reporterId: "private" }] },
    { ...ack, private: "secret" },
  ])
    expect(confirmsReportBatchCommand(reply, "post", "comment", reviewed)).toBe(false);
});
it("enforces session moderation authority and projects only reviewed public case/context fields", async () => {
  state.previewDiscussionBatch.mockResolvedValue({
    ...preview,
    private: "secret",
    publication: { ...preview.publication, authorId: "private" },
    comment: { ...preview.comment, digest: "private" },
    items: [
      {
        ...preview.items[0],
        createdAt: new Date(time),
        reporterId: "private",
        moderatorNotes: "private",
      },
    ],
  });
  await expect(
    reports.previewDiscussionBatch({ ...actor, role: "user" }, "post", "comment", input),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.previewDiscussionBatch).not.toHaveBeenCalled();
  const result = await reports.previewDiscussionBatch(actor, "post", "comment", input);
  expect(confirmsReportBatchPreview(result, "post", "comment", input)).not.toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/private|secret|reporterId|authorId|digest/u);
  await reports.decideDiscussionBatch(actor, "post", "comment", {
    ...input,
    previewRevision: token,
  });
  expect(state.decideDiscussionBatch).toHaveBeenCalledWith(
    "staff",
    "post",
    "comment",
    { ...input, previewRevision: token },
    [expect.stringMatching(/^aud_/u)],
  );
  await expect(
    reports.previewDiscussionBatch(actor, "../foreign", "comment", input),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    reports.decideDiscussionBatch(actor, "post", "comment", {
      ...input,
      previewRevision: token,
      actorId: "foreign",
    }),
  ).rejects.toMatchObject({ code: "REPORT_BATCH_INVALID" });
  expect(state.decideDiscussionBatch).toHaveBeenCalledTimes(1);
});
it("projects server publication history through the shared editorial service without moderator identity or raw audit details", async () => {
  state.history.mockResolvedValue({
    server: { id: "srv", name: "Server" },
    item: { id: "post", title: "Title", status: "archived", revision: time, recoverable: true },
    olderCursor: null,
    events: [
      {
        id: "event",
        action: "content.restored_by_server",
        createdAt: time,
        from: "archived",
        to: "draft",
        actorUsername: "editor",
        actorName: "Editor",
        notes: "private",
      },
      {
        id: "staff",
        action: "content.archived",
        createdAt: time,
        from: "published",
        to: "archived",
        actorUsername: "PRIVATE_MODERATOR",
        actorName: "Moderator",
      },
    ],
  });
  const result = await servers.history("srv", actor, "post", { cursor: undefined });
  expect(state.history).toHaveBeenCalledWith("post", "staff", undefined, undefined, "srv");
  expect(serverPublicationHistorySchema.safeParse(result).success).toBe(true);
  expect(result.events[0]).toMatchObject({
    kind: "restored",
    actor: "team",
    identity: { username: "editor", name: "Editor" },
  });
  expect(result.events[1].identity).toBeNull();
  expect(JSON.stringify(result)).not.toMatch(/PRIVATE_MODERATOR|notes|private/u);
  state.history.mockRejectedValueOnce(new AppError("Revoked", 403, "FORBIDDEN"));
  await expect(servers.history("srv", actor, "post", { cursor: undefined })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
});
it("uses trusted server restoration audit, a microsecond observed revision and strict saved-scope acknowledgements", async () => {
  const ack = { id: "post", serverId: "srv", status: "draft", revision: next };
  state.restore.mockResolvedValue(ack);
  expect(await servers.restore("srv", actor, "post", { expectedRevision: time })).toEqual(ack);
  expect(state.restore).toHaveBeenCalledWith(
    "post",
    "staff",
    time,
    expect.objectContaining({
      actorId: "staff",
      action: "content.restored_by_server",
      targetId: "post",
    }),
    undefined,
    "srv",
  );
  expect(confirmedServerPublicationRestore(ack, "post", "srv", time)).toBe(true);
  for (const reply of [
    { ...ack, id: "foreign" },
    { ...ack, serverId: "foreign" },
    { ...ack, status: "published" },
    { ...ack, revision: time },
    { ...ack, organizationId: "private" },
  ])
    expect(confirmedServerPublicationRestore(reply, "post", "srv", time)).toBe(false);
  await expect(
    servers.restore("../foreign", actor, "post", { expectedRevision: time }),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  await expect(
    servers.restore("srv", actor, "post", { expectedRevision: time, serverId: "foreign" }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.restore).toHaveBeenCalledTimes(1);
});
it("maintains full RU/EN action and recovery labels", () => {
  expect(Object.keys(reportBatchCopy("ru"))).toEqual(Object.keys(reportBatchCopy("en")));
  expect(Object.keys(serverPublicationHistoryCopy("ru"))).toEqual(
    Object.keys(serverPublicationHistoryCopy("en")),
  );
});
