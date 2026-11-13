import { expect, it, vi } from "vitest";
import { submitContentCommentRequest } from "../../site/src/lib/content-comment-client";
import {
  discussionCommentSchema,
  encodeDiscussionCursor,
  parseDiscussionCursor,
} from "../../site/src/lib/content-discussion-contract";
import {
  discussionError,
  discussionWriteNeedsSignIn,
  getDiscussionCopy,
} from "../../site/src/lib/content-discussion-copy";
import { getDictionary } from "../../site/src/lib/i18n";
import { formatNotification } from "../../site/src/lib/notification-copy";

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
const INTENT = "12345678-1234-4234-8234-123456789abc";

it("sends a scoped reply with a frozen Idempotency-Key and confirms persistence", async () => {
  const fetchImpl = vi.fn(
    async (_url: RequestInfo | URL, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          comment: {
            id: "cmt_12345678123442348234123456789abc",
            authorId: "usr_a",
            contentId: "content",
            text: "Reply text",
            parentId: "parent",
          },
          replayed: false,
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
        intentKey: INTENT,
        expectedActorId: "usr_a",
        locale: "ru",
        fallbackError: "error",
      },
      fetchImpl,
    ),
  ).toBe("cmt_12345678123442348234123456789abc");
  expect(fetchImpl.mock.calls[0][1]?.headers).toMatchObject({
    "Idempotency-Key": INTENT,
  });
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
      new Response(
        JSON.stringify({
          comment: { id: "cmt_12345678123442348234123456789abc", authorId: "usr_a", ...comment },
        }),
        {
          status: 201,
        },
      ),
  );
  await expect(
    submitContentCommentRequest(
      {
        slug: "article",
        contentId: "content",
        text: "Reply text",
        parentId: "parent",
        intentKey: INTENT,
        expectedActorId: "usr_a",
        fallbackError: "Unconfirmed",
      },
      fetchImpl,
    ),
  ).rejects.toThrow("Unconfirmed");
});
it.each(["en", "ru"] as const)(
  "maps unauthorized comment writes to sign-in recovery in %s",
  async (locale) => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(JSON.stringify({ code: "UNAUTHORIZED" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(
      submitContentCommentRequest(
        {
          slug: "article",
          contentId: "content",
          text: "Guest draft",
          intentKey: INTENT,
          expectedActorId: "usr_a",
          locale,
          fallbackError: "fallback",
        },
        fetchImpl,
      ),
    ).rejects.toMatchObject({
      name: "ContentCommentSubmitError",
      code: "UNAUTHORIZED",
      message: discussionError(locale, "UNAUTHORIZED"),
    });
    expect(discussionWriteNeedsSignIn("UNAUTHORIZED")).toBe(true);
    expect(discussionWriteNeedsSignIn("FORBIDDEN")).toBe(false);
  },
);

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
it("does not confirm a different comment id even if all other fields match", async () => {
  const fetchImpl = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          comment: {
            id: "cmt_foreign",
            authorId: "usr_a",
            contentId: "content",
            text: "Reply text",
            parentId: "parent",
          },
        }),
        { status: 201 },
      ),
  );
  await expect(
    submitContentCommentRequest(
      {
        slug: "article",
        contentId: "content",
        text: "Reply text",
        parentId: "parent",
        intentKey: INTENT,
        expectedActorId: "usr_a",
        fallbackError: "Unconfirmed",
      },
      fetchImpl,
    ),
  ).rejects.toThrow("Unconfirmed");
});
