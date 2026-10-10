import { expect, it } from "vitest";
import {
  parsePublicationQuery,
  publicationPageQuery,
  publicationPageSchema,
} from "../apps/web/src/lib/publication-feed-contract";
import {
  discussionEditSchema,
  discussionRemoveSchema,
} from "../apps/web/src/lib/content-discussion-contract";
import { confirmsDiscussionMutation } from "../apps/web/src/lib/discussion-mutation-confirmation";
import { publicationCopy } from "../apps/web/src/lib/publication-feed-copy";
import { getDiscussionCopy, discussionError, discussionMutationError } from "../apps/web/src/lib/content-discussion-copy";
it.each([
  "?type=bad",
  "?source=bad",
  "?q=x&q=y",
  "?type=article&type=post",
  "?source=user&source=server",
  "?cursor=no",
  "?actorId=victim",
  `?q=${"x".repeat(101)}`,
])("rejects invalid publication query %s", (query) => {
  expect(parsePublicationQuery(new URLSearchParams(query))).toBeNull();
});
it("retains exact microsecond cursor and canonical trimmed filters", () => {
  const cursor = { createdAt: "2026-10-10T12:00:00.123456Z", id: "publication" };
  expect(
    parsePublicationQuery(
      new URLSearchParams({
        type: "news",
        source: "organization",
        q: " query ",
        cursor: JSON.stringify(cursor),
      }),
    ),
  ).toEqual({ type: "news", source: "organization", query: "query", cursor });
  expect(parsePublicationQuery(new URLSearchParams({ source: "user" }), false)).toBeNull();
});
it("normalizes SSR filters without honoring injected scope or cursor", () => {
  expect(
    publicationPageQuery(
      { type: ["question", "news"], q: " x ", source: "user", cursor: "bad", actorId: "victim" },
      false,
    ),
  ).toEqual({ type: "question", query: "x", source: undefined, cursor: undefined });
  expect(
    publicationPageQuery({ type: "bad", source: "bad", q: "x".repeat(200) }).query,
  ).toHaveLength(100);
});
it("rejects unbounded pages and inconsistent continuation", () => {
  expect(
    publicationPageSchema.safeParse({ items: [], hasMore: true, nextCursor: null }).success,
  ).toBe(false);
  expect(
    publicationPageSchema.safeParse({ items: [], hasMore: false, nextCursor: null }).success,
  ).toBe(true);
});
it("requires a revision and forbids target/actor injection in comment commands", () => {
  const expectedRevision = "a".repeat(64);
  expect(discussionEditSchema.parse({ text: " Edited comment ", expectedRevision })).toEqual({
    text: "Edited comment",
    expectedRevision,
  });
  for (const extra of [
    { authorId: "victim" },
    { contentId: "other" },
    { parentId: "parent" },
    { productId: "product" },
  ])
    expect(
      discussionEditSchema.safeParse({ text: "Edit", expectedRevision, ...extra }).success,
    ).toBe(false);
  expect(discussionEditSchema.safeParse({ text: "Edit" }).success).toBe(false);
  expect(discussionRemoveSchema.safeParse({ text: "Edit", expectedRevision }).success).toBe(false);
  expect(
    discussionRemoveSchema.safeParse({ reason: "x".repeat(1001), expectedRevision }).success,
  ).toBe(false);
});
it("confirms exact persistence before updating the client", () => {
  const revision = "a".repeat(64);
  expect(
    confirmsDiscussionMutation(
      { contentId: "content", commentId: "comment", text: "Edit", revision },
      "content",
      "comment",
      "Edit",
    ),
  ).toBe(true);
  expect(
    confirmsDiscussionMutation(
      { contentId: "content", commentId: "comment", removed: true },
      "content",
      "comment",
    ),
  ).toBe(true);
  for (const payload of [
    null,
    { removed: true },
    { contentId: "other", commentId: "comment", removed: true },
    { contentId: "content", commentId: "other", removed: true },
    { contentId: "content", commentId: "comment", text: "Old", revision },
    { contentId: "content", commentId: "comment", text: "Edit", revision: "bad" },
  ])
    expect(confirmsDiscussionMutation(payload, "content", "comment", "Edit")).toBe(false);
});
it("has matching complete RU/EN keys and localized conflict feedback", () => {
  expect(Object.keys(publicationCopy("ru"))).toEqual(Object.keys(publicationCopy("en")));
  expect(Object.keys(getDiscussionCopy("ru"))).toEqual(Object.keys(getDiscussionCopy("en")));
  expect(discussionError("ru", "COMMENT_CHANGED")).toBe(getDiscussionCopy("ru").changed);
  expect(discussionMutationError("ru", "INTERNAL_ERROR")).toBe(getDiscussionCopy("ru").writeUnavailable);
  expect(discussionError("en", "COMMENT_COMMAND_INVALID")).toBe(getDiscussionCopy("en").invalidCommand);
});
