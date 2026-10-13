import { expect, it } from "vitest";
import {
  discussionPushReceipt,
  withDiscussionPushReceipt,
} from "../packages/db/src/repositories/discussion-push-receipt";

it.each(["pending", "queued", "unavailable"] as const)(
  "accepts exact server admission evidence %s",
  (state) => {
    expect(discussionPushReceipt(withDiscussionPushReceipt(state))).toBe(state);
  },
);
it.each(
  [
    null,
    {},
    [],
    { discussionPush: { version: 1, state: "pending" } },
    { kind: "discussion_push", discussionPush: { version: 2, state: "pending" } },
    { kind: "discussion_push", discussionPush: { version: 1, state: "sent" } },
    { kind: "discussion_push", discussionPush: { version: 1, state: "pending", extra: true } },
    { kind: "build_review", discussionPush: { version: 1, state: "pending" } },
  ].map((value) => ({ value })),
)("denies unproven legacy or malformed receipts %#", ({ value }) =>
  expect(discussionPushReceipt(value)).toBeNull(),
);
