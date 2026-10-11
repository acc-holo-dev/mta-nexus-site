import { beforeEach, expect, it, vi } from "vitest";
import type { User } from "@nexus/domain";
const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  find: vi.fn(),
  mutate: vi.fn(),
  approvals: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  discussionWorkspaceRepository: { page: mocks.page, find: mocks.find, mutate: mocks.mutate },
  publicVerificationHistoryRepository: { page: mocks.approvals },
}));
import { discussionWorkspaceService as own } from "../apps/web/src/lib/services/discussion-workspace-service";
import { publicVerificationHistoryService as approvals } from "../apps/web/src/lib/services/public-verification-history-service";
import {
  ownDiscussionHref,
  ownDiscussionPageSchema,
  ownDiscussionSchema,
  parseOwnDiscussionQuery,
} from "../apps/web/src/lib/discussion-workspace-contract";
import {
  approvalPageHref,
  parseApprovalQuery,
  publicApprovalPageSchema,
} from "../apps/web/src/lib/public-verification-history-contract";
import {
  ownDiscussionCopy,
  ownDiscussionError,
} from "../apps/web/src/lib/discussion-workspace-copy";
import { approvalCopy, approvalError } from "../apps/web/src/lib/public-verification-history-copy";
const actor = { id: "actor", role: "user" } as User,
  time = "2026-10-11T00:00:00.123456Z";
const row = {
  id: "comment",
  contentId: "private-parent",
  text: "My text",
  createdAt: new Date(time),
  slug: null,
  title: null,
  type: null,
  available: false,
  revision: "a".repeat(64),
  editable: false,
  authorId: "actor",
  reviewNotes: "secret",
  parent: "private reply",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.page.mockResolvedValue({
    items: [row],
    hasMore: true,
    nextCursor: { createdAt: time, id: "comment" },
  });
  mocks.find.mockResolvedValue(row);
  mocks.mutate.mockResolvedValue({ removed: true });
  mocks.approvals.mockResolvedValue({
    subject: {
      username: "writer",
      name: "Writer",
      identityVerified: false,
      developerVerified: false,
      id: "private",
      email: "secret",
    },
    items: [
      {
        key: "b".repeat(32),
        type: "user",
        approvedAt: new Date(time),
        proofUrl: "secret",
        reviewNotes: "secret",
        id: "private",
      },
    ],
    context: "a".repeat(64),
    hasMore: true,
    nextCursor: { createdAt: time, id: "b".repeat(32) },
  });
});
it.each([
  "?actorId=other",
  "?q=a&q=b",
  "?availability=private",
  "?q=%0A",
  `?q=${"x".repeat(121)}`,
  "?cursor=bad",
  "?cursor=",
])("rejects malformed or injected own filters %s", (query) => {
  expect(parseOwnDiscussionQuery(new URLSearchParams(query))).toBeNull();
});
it.each(["?includeProof=true", "?type=user&type=developer", "?type=organization", "?cursor=bad"])(
  "rejects private or unsupported approval filters %s",
  (query) => {
    expect(parseApprovalQuery(new URLSearchParams(query))).toBeNull();
  },
);
it("normalizes search and produces durable encoded navigation with exact cursor bytes", async () => {
  const page = await own.page(actor, { query: "Lua", availability: "unavailable" });
  const url = new URL(
    ownDiscussionHref({ query: "Lua", availability: "unavailable" }, page.nextCursor),
    "https://nexus.test",
  );
  const query = parseOwnDiscussionQuery(url.searchParams);
  expect(query?.cursor?.createdAt).toBe(time);
  expect(query?.cursor?.context).toMatch(/^[a-f0-9]{64}$/u);
  expect(parseOwnDiscussionQuery(new URLSearchParams("q=+Lua+"))?.query).toBe("Lua");
  expect(ownDiscussionHref({ query: "" })).toBe("/workspace/discussions");
  expect(approvalPageHref("Writer", { type: "developer" }, "a&b")).toContain("cursor=a%26b");
});
it.each(["2026-02-30T00:00:00.123456Z", "2026-10-11T00:00:00Z", "2026-10-11T00:00:00.1234567Z"])(
  "rejects invalid or imprecise cursor timestamp %s",
  (createdAt) => {
    const cursor = JSON.stringify({
      createdAt,
      id: "b".repeat(32),
      context: "a".repeat(64),
      version: 1,
    });
    expect(parseOwnDiscussionQuery(new URLSearchParams({ cursor }))).toBeNull();
    expect(parseApprovalQuery(new URLSearchParams({ cursor }))).toBeNull();
  },
);
it("projects only bounded own-comment DTO fields", async () => {
  const page = await own.page(actor, { query: "" }),
    detail = await own.own(actor, "comment");
  expect(ownDiscussionPageSchema.safeParse(page).success).toBe(true);
  expect(ownDiscussionSchema.safeParse(detail).success).toBe(true);
  expect(JSON.stringify(page)).not.toMatch(/contentId|authorId|reviewNotes|private reply/u);
  expect(JSON.stringify(detail)).not.toMatch(/authorId|reviewNotes|private reply/u);
  expect(mocks.find).toHaveBeenCalledWith("actor", "comment");
  expect(ownDiscussionPageSchema.safeParse({ ...page, hasMore: false }).success).toBe(false);
});
it.each([
  { id: "other", query: "Lua", availability: "available" },
  { id: "actor", query: "Changed", availability: "available" },
  { id: "actor", query: "Lua", availability: "unavailable" },
])("rejects own cursor replay across account or filters %j before SQL", async (input) => {
  const first = await own.page(actor, { query: "Lua", availability: "available" });
  const parsed = parseOwnDiscussionQuery(new URLSearchParams({ cursor: first.nextCursor ?? "" }));
  if (!parsed) throw new Error("Bad fixture");
  mocks.page.mockClear();
  await expect(
    own.page(
      { ...actor, id: input.id },
      {
        ...parsed,
        query: input.query,
        availability: input.availability as "available" | "unavailable",
      },
    ),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(mocks.page).not.toHaveBeenCalled();
});
it("passes only session identity and generated audit identity to persistence", async () => {
  await own.mutate(actor, "comment", { expectedRevision: "a".repeat(64) });
  expect(mocks.mutate).toHaveBeenCalledWith({
    actorId: "actor",
    commentId: "comment",
    expectedRevision: "a".repeat(64),
    auditId: expect.stringMatching(/^aud_[a-f0-9]{24}$/u),
  });
});
it.each(["../other", "", "x".repeat(129)])(
  "rejects invalid own IDs %s before querying",
  async (id) => {
    await expect(own.own(actor, id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(own.mutate(actor, id, { expectedRevision: "a".repeat(64) })).rejects.toMatchObject(
      { code: "NOT_FOUND" },
    );
    expect(mocks.find).not.toHaveBeenCalled();
    expect(mocks.mutate).not.toHaveBeenCalled();
  },
);
it("projects dated approval records without evidence, staff identities or application IDs", async () => {
  const result = await approvals.page("writer");
  expect(publicApprovalPageSchema.safeParse(result).success).toBe(true);
  expect(JSON.stringify(result)).not.toMatch(/secret|private|proofUrl|reviewNotes|email/u);
  expect(result.subject.identityVerified).toBe(false);
  const parsed = parseApprovalQuery(new URLSearchParams({ cursor: result.nextCursor ?? "" }));
  expect(parsed?.cursor).toMatchObject({ createdAt: time, id: "b".repeat(32), version: 1 });
  expect(
    publicApprovalPageSchema.safeParse({
      ...result,
      subject: { ...result.subject, email: "secret" },
    }).success,
  ).toBe(false);
});
it("rejects invalid public handles without reading requests", async () => {
  await expect(approvals.page("../private")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(mocks.approvals).not.toHaveBeenCalled();
});
it("keeps full RU/EN copy keys and localized safe recovery errors", () => {
  expect(Object.keys(ownDiscussionCopy("ru"))).toEqual(Object.keys(ownDiscussionCopy("en")));
  expect(Object.keys(approvalCopy("ru"))).toEqual(Object.keys(approvalCopy("en")));
  expect(ownDiscussionError("ru", "DISCUSSION_UNAVAILABLE")).toBe(ownDiscussionCopy("ru").changed);
  expect(approvalError("ru", "INVALID_CURSOR")).toBe(approvalCopy("ru").invalid);
});
