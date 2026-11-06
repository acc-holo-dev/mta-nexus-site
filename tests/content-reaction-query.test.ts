import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { contentReactionQueryState } = await import("./helpers/content-reaction-query-harness");
  return { lockInitiatingSession: contentReactionQueryState.session };
});
vi.mock("../packages/db/src/repositories/content-reaction-notice", async () => {
  const { contentReactionQueryState } = await import("./helpers/content-reaction-query-harness");
  return { contentReactionNotice: contentReactionQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createContentReactionQueryDbMock } = await import(
    "./helpers/content-reaction-query-harness"
  );
  return createContentReactionQueryDbMock();
});

import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import { contentReactionsRepository as reactions } from "../packages/db/src/repositories/content-reactions";
import { publicUserTrustRepository as trust } from "../packages/db/src/repositories/public-user-trust";
import {
  installContentReactionQueryHooks,
  contentReactionQueryState as state,
} from "./helpers/content-reaction-query-harness";

installContentReactionQueryHooks();

it("reads only a published publication with actual distinct canonical votes and viewer-scoped selection", async () => {
  state.rows = [[["content", "guide", false, "1", "2", "0", "❤️"]]];
  expect(await reactions.state("guide", "actor")).toEqual({
    contentId: "content",
    slug: "guide",
    self: false,
    authenticated: true,
    reaction: "thanks",
    counts: { helpful: 1, thanks: 2, insight: 0 },
  });
  expect(state.queries).toHaveLength(1);
  const q = state.queries[0];
  expect(q.params).toEqual(expect.arrayContaining(["published", "actor", "guide", "content"]));
  expect(q.sql).toContain("r.created_at desc, r.id desc limit 1");
  expect(q.sql).toContain('"reactions"."user_id" <> "content"."author_id"');
  expect(q.sql).not.toMatch(/email|password|reputation|body|proof_url/u);
});

it("bounds personal history with exact keyset, canonical targets and public-only metadata", async () => {
  await reactions.page("actor", {
    query: "%_",
    reaction: "thanks",
    cursor: { createdAt: "2026-10-11T00:00:00.123456Z", id: "last" },
  });
  const q = state.queries[0];
  expect(q.params).toEqual(
    expect.arrayContaining([
      "actor",
      "published",
      "content",
      "❤️",
      "%\\%\\_%",
      "2026-10-11T00:00:00.123456Z",
      "last",
      21,
    ]),
  );
  expect(q.sql).toContain("select distinct on");
  expect(q.sql).toContain('left join "content"');
  expect(q.sql).toContain("US");
  expect(q.sql).not.toMatch(/offset|body|email|owner_id/u);
});

it("returns at most twenty canonical targets with masked metadata and microsecond continuation", async () => {
  const time = "2026-10-11T00:00:00.123456Z";
  state.rows = [
    Array.from({ length: 21 }, (_, i) => [`target-${i}`, "👍", time, time, null, null, null]),
  ];
  const page = await reactions.page("actor");
  expect(page.items).toHaveLength(20);
  expect(page.items[0].title).toBeNull();
  expect(page.nextCursor).toEqual({ createdAt: time, id: "target-19" });
});

it("projects public trust in one live snapshot, with role gates and activity privacy inside SQL", async () => {
  expect(await trust.find("writer")).toBeNull();
  const q = state.queries[0];
  expect(state.queries).toHaveLength(1);
  expect(q.sql).toContain("in ('developer', 'admin')");
  expect(q.sql).toContain("case when coalesce");
  expect(q.sql).toContain('"show_activity", true)');
  expect(q.sql).toContain("'public'");
  expect(q.sql).toContain("'active'");
  expect(q.sql).toContain("max(");
  expect(q.sql).not.toMatch(
    /proof_url|review_notes|reviewer_id|email|password|reputation_score|completed_deals|support_cases|orders/u,
  );
  expect(q.params).toEqual(["user", "developer", "writer", 1]);
});

it("computes card helpful counts from current reaction rows instead of legacy counters", async () => {
  await authorContentRepository.pagePublic(["article"]);
  expect(state.queries[0].sql).toContain("select distinct on (r.user_id)");
  expect(state.queries[0].sql).toContain("current_reactions.emoji = '👍'");
  expect(state.queries[0].sql).not.toContain('"like_count"');
});
