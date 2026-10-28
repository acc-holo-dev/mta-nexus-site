import type { User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  page: vi.fn(),
  detail: vi.fn(),
  submit: vi.fn(),
  decide: vi.fn(),
}));
vi.mock("@nexus/db", () => ({ communityReportsRepository: mocks }));

import { communityReportService as service } from "../apps/web/src/lib/services/community-report-service";

const actor = { id: "actor", role: "user" } as User,
  moderator = { ...actor, role: "moderator" } as User;
const row = {
  id: "report",
  targetType: "comment",
  targetId: "comment",
  type: "abuse",
  reason: "Reason",
  status: "open",
  evidenceUrls: ["javascript:alert(1)", "https://safe.test"],
  createdAt: new Date("2026-10-10T00:00:00Z"),
  resolvedAt: null,
  reporterId: "private-id",
  moderatorNotes: "private note",
  email: "private@nexus.test",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.page.mockResolvedValue({ items: [row], hasMore: false });
  mocks.detail.mockResolvedValue({
    ...row,
    target: {
      id: "comment",
      kind: "comment",
      text: "x".repeat(5010),
      title: "Title",
      slug: "a/b",
      author: "author",
      status: "published",
      revision: "a".repeat(64),
      truncated: true,
    },
  });
});
it("uses session scope and excludes staff/account fields from owner history and details", async () => {
  const filters = { page: 1, view: "pending" as const, target: undefined, type: undefined };
  const result = await service.page(actor, filters);
  expect(mocks.page).toHaveBeenCalledWith({ actorId: "actor", staff: false }, filters);
  expect(result.items[0].evidenceUrls).toEqual(["https://safe.test/"]);
  const detail = await service.detail(actor, "report");
  expect(detail.target).toMatchObject({
    href: "/articles/a%2Fb#comment-comment",
    revision: null,
    truncated: true,
  });
  expect(detail.target?.text).toHaveLength(5000);
  for (const value of [result, detail]) {
    expect(JSON.stringify(value)).not.toMatch(/private note|private-id|private@nexus/u);
    expect(value).not.toHaveProperty("moderatorNotes");
  }
});
it("projects staff notes only after role checks and never links unpublished targets publicly", async () => {
  await expect(service.detail(actor, "report", true)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(mocks.detail).not.toHaveBeenCalled();
  mocks.detail.mockResolvedValue({
    ...row,
    target: {
      kind: "content",
      title: "Draft",
      text: "Body",
      slug: "draft",
      status: "draft",
      author: "author",
      revision: null,
      truncated: false,
    },
  });
  expect(await service.detail(moderator, "report", true)).toMatchObject({
    moderatorNotes: "private note",
    reporterId: "private-id",
    target: { href: null },
  });
});
it("returns target-bound confirmations for new and idempotent report submissions", async () => {
  mocks.submit.mockResolvedValue({ id: "report", created: false });
  const input = {
    targetType: "content" as const,
    targetId: "content",
    type: "spam" as const,
    reason: "Spam content",
    evidenceUrls: [],
  };
  expect(await service.submit(actor, input)).toEqual({
    id: "report",
    created: false,
    targetType: "content",
    targetId: "content",
  });
  expect(mocks.submit).toHaveBeenCalledWith(
    expect.objectContaining({ ...input, actorId: "actor" }),
  );
});
it("denies nonstaff writes and passes actor identity and independent audit IDs to the transaction", async () => {
  const input = { action: "resolve" as const, expectedStatus: "open" as const, notes: "Reviewed" };
  await expect(service.decide(actor, "report", input, "session")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(mocks.decide).not.toHaveBeenCalled();
  await service.decide(moderator, "report", input, "session");
  const command = mocks.decide.mock.calls[0][0];
  expect(command).toMatchObject({
    ...input,
    actorId: "actor",
    id: "report",
    currentToken: "session",
  });
  expect(command.auditId).not.toBe(command.removalAuditId);
});
