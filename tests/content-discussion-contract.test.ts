import { expect, it, vi } from "vitest";
import {
  discussionCommentSchema,
  parseDiscussionCursor,
  encodeDiscussionCursor,
} from "../apps/web/src/lib/content-discussion-contract";
import { submitContentCommentRequest } from "../apps/web/src/lib/content-comment-client";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
import { getDictionary } from "../apps/web/src/lib/i18n";
import { discussionError, getDiscussionCopy } from "../apps/web/src/lib/content-discussion-copy";
it("round trips exact microsecond cursors through URL query encoding", () => {
  const cursor = { createdAt: "2026-10-10T12:00:00.000123Z", id: "id/with spaces" };
  const params = new URLSearchParams({ cursor: encodeDiscussionCursor(cursor) });
  expect(parseDiscussionCursor(params)).toEqual(cursor);
  expect(parseDiscussionCursor(new URLSearchParams())).toBeUndefined();
});
it.each([
  { createdAt: "not-a-date", id: "id" },
  { createdAt: "2026-02-31T12:00:00.000123Z", id: "id" },
  { createdAt: "0000-10-10T12:00:00.000123Z", id: "id" },
  { createdAt: "2026-10-10T12:00:00.000Z", id: "" },
  { createdAt: "2026-10-10T12:00:00.000Z", id: "id", scope: "other" },
])("rejects invalid cursor %j", (cursor) =>
  expect(parseDiscussionCursor(new URLSearchParams({ cursor: JSON.stringify(cursor) }))).toBeNull(),
);
it("rejects authority injection, short text and oversized parents", () => {
  expect(discussionCommentSchema.safeParse({ text: " x " }).success).toBe(false);
  expect(discussionCommentSchema.safeParse({ text: "reply", authorId: "victim" }).success).toBe(
    false,
  );
  expect(
    discussionCommentSchema.safeParse({ text: "reply", parentId: "p".repeat(129) }).success,
  ).toBe(false);
  expect(discussionCommentSchema.safeParse({ text: "x".repeat(5000) }).success).toBe(true);
});
it("sends a scoped reply and confirms the persisted text, target and parent", async () => {
  const fetchImpl = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          comment: { id: "reply", contentId: "content", text: "Reply text", parentId: "parent" },
        }),
        { status: 201 },
      ),
  );
  expect(
    await submitContentCommentRequest(
      {
        slug: "article",
        contentId: "content",
        text: " Reply text ",
        parentId: "parent",
        locale: "ru",
        fallbackError: "error",
      },
      fetchImpl,
    ),
  ).toBe("reply");
  expect(fetchImpl.mock.calls[0][1]?.body).toBe(
    JSON.stringify({ text: "Reply text", parentId: "parent" }),
  );
});
it.each([
  { contentId: "other", text: "Reply text", parentId: "parent" },
  { contentId: "content", text: "different", parentId: "parent" },
  { contentId: "content", text: "Reply text", parentId: null },
])("does not confirm a mismatched saved reply %j", async (comment) => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(JSON.stringify({ comment: { id: "reply", ...comment } }), { status: 201 }),
  );
  await expect(
    submitContentCommentRequest(
      {
        slug: "article",
        contentId: "content",
        text: "Reply text",
        parentId: "parent",
        fallbackError: "Unconfirmed",
      },
      fetchImpl,
    ),
  ).rejects.toThrow("Unconfirmed");
});
it.each(["en", "ru"] as const)(
  "localizes known reply errors and existing comment notifications in %s",
  (locale) => {
    expect(discussionError(locale, "COMMENT_PARENT_NOT_FOUND")).toBe(
      getDiscussionCopy(locale).invalidParent,
    );
    const notice = formatNotification(
      { title: "New article comment", message: "@writer commented on “Article”." },
      getDictionary(locale).buildReviewNotifications,
      locale,
    );
    expect(notice.title).toBe(locale === "ru" ? "Новый комментарий" : "New comment");
    expect(notice.message).toContain("@writer");
    expect(notice.message).toContain("Article");
  },
);
