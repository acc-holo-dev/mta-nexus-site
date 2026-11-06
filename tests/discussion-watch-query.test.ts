import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscussionWatchQueryDbMock } = await import(
    "./helpers/discussion-watch-query-harness"
  );
  return createDiscussionWatchQueryDbMock();
});

import { followWorkspaceRepository as repository } from "../packages/db/src/repositories/follow-workspace";
import {
  installDiscussionWatchQueryHooks,
  discussionWatchQueryState as state,
} from "./helpers/discussion-watch-query-harness";

installDiscussionWatchQueryHooks();

it("locks only a currently public editorial publication before subscribing with database time", async () => {
  state.rows = [[["article"]], [["follow", true]]];
  expect(await repository.setFollowing("reader", "content", "article", true, "follow")).toEqual({
    following: true,
    created: true,
    notifyComments: true,
  });
  expect(state.queries[0].params).toEqual([JSON.stringify(["reader", "content", "article"])]);
  expect(state.queries[1].sql).toContain('"content"."product_id" is null');
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].params).toEqual(
    expect.arrayContaining(["published", "post", "news", "article", "review"]),
  );
  expect(state.queries[1].params).not.toContain("resource");
  expect(state.queries[2].sql).toContain("clock_timestamp()");
  expect(state.queries[2].sql).toContain("on conflict do nothing");
  expect(state.queries[2].params).toEqual(expect.arrayContaining([true]));
});

it("stores quiet Save with notifyComments false and upgrades an existing row on watch", async () => {
  state.rows = [[["article"]], [["follow", false]]];
  expect(
    await repository.setFollowing("reader", "content", "article", true, "follow", {
      notifyComments: false,
    }),
  ).toEqual({ following: true, created: true, notifyComments: false });
  expect(state.queries[2].params).toEqual(expect.arrayContaining([false]));
  state.queries = [];
  // conflict path: empty insert return, update (no returning), then select
  state.rows = [[["article"]], [], [], [["existing", true]]];
  expect(
    await repository.setFollowing("reader", "content", "article", true, "follow", {
      notifyComments: true,
    }),
  ).toEqual({ following: true, created: false, notifyComments: true });
  expect(
    state.queries.some((q) => q.sql.startsWith("update") && q.sql.includes("notify_comments")),
  ).toBe(true);
});

it("confirms repeated subscriptions and denies an inaccessible publication", async () => {
  state.rows = [[["article"]], [], [], [["existing", true]]];
  expect(await repository.setFollowing("reader", "content", "article", true, "follow")).toEqual({
    following: true,
    created: false,
    notifyComments: true,
  });
  expect(state.queries.at(-1)?.params).toEqual(["reader", "content", "article", 1]);
  state.rows = [[]];
  await expect(
    repository.setFollowing("reader", "content", "draft", true, "follow"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
});

it("unsubscribes the exact private key without reading a deleted or archived target", async () => {
  expect(await repository.setFollowing("reader", "content", "deleted", false, "unused")).toEqual({
    following: false,
    created: false,
    notifyComments: false,
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].sql).toContain('delete from "follows"');
  expect(state.queries[1].params).toEqual(["reader", "content", "deleted"]);
});

it("scopes saved discussion metadata within the accessible join and bounds latest reply lookups", async () => {
  await repository.page("reader", { type: "content", query: "%_" });
  const query = state.queries[0];
  expect(query.sql).toContain('left join "content"');
  expect(query.sql).toContain('case when "content"."id" is not null then jsonb_build_object');
  expect(query.sql.match(/order by created_at desc,id desc limit 1/gu)).toHaveLength(2);
  expect(query.sql).toContain("'latestAt'");
  expect(query.sql).toContain('"content"."product_id" is null');
  expect(query.params).toEqual(
    expect.arrayContaining(["reader", "content", "published", "%\\%\\_%", 21]),
  );
  expect(query.sql).not.toMatch(/comments\.text|email|password|storage_key/u);
});
