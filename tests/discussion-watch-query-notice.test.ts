import { createHash } from "node:crypto";
import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscussionWatchQueryDbMock } = await import(
    "./helpers/discussion-watch-query-harness"
  );
  return createDiscussionWatchQueryDbMock();
});

import { db } from "../packages/db/src/client";
import { followWorkspaceRepository as repository } from "../packages/db/src/repositories/follow-workspace";
import {
  installDiscussionWatchQueryHooks,
  discussionWatchQueryStamp as stamp,
  discussionWatchQueryState as state,
} from "./helpers/discussion-watch-query-harness";

installDiscussionWatchQueryHooks();

const notice = () =>
  db.transaction((tx) => repository.discussionNoticeWithin(tx, "reader", "article", "reply"));

it("collects distinct live direct participants and excludes the comment author", async () => {
  state.rows = [[["writer", stamp, "owner", "parent"]], [["owner"]]];
  expect(await repository.discussionAudience("article", "reply")).toEqual({
    authorId: "writer",
    createdAt: stamp,
    directRecipients: ["owner"],
  });
  expect(state.queries[0].sql).toContain('inner join "content"');
  expect(state.queries[1].params).toEqual(["parent", "article", 1]);
  state.rows = [[["owner", stamp, "owner", null]]];
  expect((await repository.discussionAudience("article", "reply"))?.directRecipients).toEqual([]);
});

it("stops before looking up participants if the comment or public publication is gone", async () => {
  expect(await repository.discussionAudience("article", "reply")).toBeNull();
  expect(state.queries).toHaveLength(1);
});

it("walks fifty followers with a sentinel, event watermark and exact ascending timestamp/id cursor", async () => {
  state.rows = [Array.from({ length: 51 }, (_, i) => [`follow_${i}`, `reader_${i}`, stamp])];
  const page = await repository.discussionFollowers(
    "article",
    stamp,
    ["writer", "owner", "parent"],
    { id: "previous", createdAt: stamp },
  );
  expect(page.items).toHaveLength(50);
  expect(page.nextCursor).toEqual({ id: "follow_49", createdAt: stamp });
  const query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining([
      "content",
      "article",
      true,
      "writer",
      "owner",
      "parent",
      stamp,
      "previous",
      51,
    ]),
  );
  expect(query.sql).toContain('"follows"."notify_comments" =');
  expect(query.sql).toContain("object_notification_mutes");
  expect(query.sql).toContain('"follows"."created_at"<=');
  expect(query.sql).toContain('("follows"."created_at","follows"."id")>');
  expect(query.sql).toContain('order by "follows"."created_at" asc, "follows"."id" asc');
  expect(query.sql).toContain('"follows"."follower_id" <>');
});

it("rechecks the exact current recipient subscription while locking the publication and comment", async () => {
  state.rows = [
    [["article", "current-slug", "owner"]],
    [["writer", null, stamp]],
    [],
    [["follow", true]],
  ];
  const result = await notice();
  const digest = createHash("sha256")
    .update(JSON.stringify([1, "article", "reply", "reader"]))
    .digest("hex");
  expect(result).toEqual({
    direct: false,
    following: true,
    id: `ntf_reply_${digest}`,
    link: "/articles/current-slug?comment=reply#comment-reply",
  });
  expect(state.queries[0].params).toEqual([JSON.stringify(["reader", "content", "article"])]);
  expect(state.queries.slice(1, 3).every((q) => q.sql.includes("for share"))).toBe(true);
  expect(state.queries[2].params).toEqual(["reply", "article", 1]);
  expect(state.queries[3].sql).toContain("object_notification_mutes");
  expect(state.queries[4].params).toEqual(["reader", "content", "article", stamp, 1]);
  expect(JSON.stringify(result)).not.toContain("writer");
});

it("recognizes a current parent participant without requiring a subscription", async () => {
  state.rows = [
    [["article", "article", "owner"]],
    [["writer", "parent", stamp]],
    [],
    [["reader"]],
    [],
  ];
  expect(await notice()).toMatchObject({ direct: true, following: false });
  expect(state.queries[4].params).toEqual(["parent", "article", 1]);
});

it("suppresses follow and direct delivery while an object mute is active", async () => {
  state.rows = [[["article", "article", "owner"]], [["writer", null, stamp]], [["mute"]]];
  expect(await notice()).toBeNull();
  expect(state.queries.some((q) => q.sql.includes("object_notification_mutes"))).toBe(true);
  expect(state.queries.every((q) => !q.sql.startsWith("insert"))).toBe(true);
});

it("treats quiet content follows as non-following for comment notices", async () => {
  state.rows = [
    [["article", "article", "owner"]],
    [["writer", null, stamp]],
    [],
    [["follow", false]],
  ];
  expect(await notice()).toBeNull();
});

it.each(["unsubscribed", "late_subscription", "deleted_comment", "hidden_publication", "self"])(
  "suppresses %s delivery before any inbox write",
  async (kind) => {
    if (kind === "hidden_publication") state.rows = [[]];
    else if (kind === "deleted_comment") state.rows = [[["article", "article", "owner"]], []];
    else
      state.rows = [
        [["article", "article", "owner"]],
        [[kind === "self" ? "reader" : "writer", null, stamp]],
        [],
        [],
      ];
    expect(await notice()).toBeNull();
    expect(state.queries.every((q) => !q.sql.startsWith("insert"))).toBe(true);
    if (kind === "self") expect(state.queries).toHaveLength(3);
  },
);

it.each(["bad/path", "", "x".repeat(129)])(
  "rejects malformed source IDs %s before storage",
  async (id) => {
    await expect(repository.discussionAudience(id, "reply")).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    await expect(
      db.transaction((tx) => repository.discussionNoticeWithin(tx, "reader", "article", id)),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);

it.each([
  ["article", "bad", [], undefined],
  ["article", stamp, ["one", "two", "three", "four"], undefined],
  ["article", stamp, [], { id: "invalid/", createdAt: stamp }],
  ["article", stamp, [], { id: "valid", createdAt: "2026-10-12T00:00:00.123Z" }],
] as const)(
  "rejects malformed fanout input without scanning subscriptions",
  async (id, time, excluded, cursor) => {
    await expect(
      repository.discussionFollowers(id, time, [...excluded], cursor),
    ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(state.queries).toHaveLength(0);
  },
);
