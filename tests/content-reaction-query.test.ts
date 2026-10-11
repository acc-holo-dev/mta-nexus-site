import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/content-reaction-notice", () => ({
  contentReactionNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") && !sql.includes("pg_advisory_xact_lock")
          ? (state.rows.shift() ?? [])
          : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown) => work(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { contentReactionsRepository as reactions } from "../packages/db/src/repositories/content-reactions";
import { publicUserTrustRepository as trust } from "../packages/db/src/repositories/public-user-trust";
import { authorContentRepository } from "../packages/db/src/repositories/author-content";
const command = {
  actorId: "actor",
  slug: "guide",
  reaction: "helpful" as "helpful" | "thanks" | null,
  reactionId: "new",
  auditId: "audit",
};
const writes = () => state.queries.filter((query) => /^(insert|delete|update)/u.test(query.sql));
const fixture = (existing: unknown[][] = [], status = "published", author = "author") => {
  state.rows = [
    [["content", "guide", status, "article", author]],
    [["actor"]],
    existing,
    [["👍", 1]],
  ];
};
beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
});
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
it("serializes writes on publication, pair and live account, then saves desired state and audit atomically", async () => {
  fixture();
  expect(await reactions.set(command)).toMatchObject({
    contentId: "content",
    reaction: "helpful",
    counts: { helpful: 1, thanks: 0, insight: 0 },
    changed: true,
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[2].sql).toContain("for share");
  expect(state.queries[3].sql).toContain("for update");
  expect(writes().map((q) => q.sql.split(" ")[0])).toEqual([
    "delete",
    "insert",
    "insert",
    "update",
  ]);
  expect(state.notice).toHaveBeenCalledOnce();
  expect(writes().at(-1)?.sql).not.toMatch(/updated_at|published_at|status|reputation/u);
  expect(writes()[2].params).toContain("content.reaction_changed");
});
it("treats retries as desired state and repairs only the derived counter", async () => {
  fixture([["existing", "👍"]]);
  expect(await reactions.set(command)).toHaveProperty("changed", false);
  expect(writes()).toHaveLength(1);
  expect(writes()[0].sql).toContain('update "content"');
  expect(state.notice).not.toHaveBeenCalled();
});
it("normalizes legacy duplicates when switching without adding a repeated notice", async () => {
  fixture([
    ["first", "👍"],
    ["second", "💡"],
  ]);
  await reactions.set({ ...command, reaction: "thanks" });
  const deletion = writes()[0];
  expect(deletion.params).toEqual(["actor", "content", "content"]);
  expect(deletion.sql).not.toContain("limit");
  expect(writes()[1].params).toContain("❤️");
  expect(state.notice).not.toHaveBeenCalled();
});
it.each(["draft", "archived"])(
  "denies public mutations of %s publications before any write",
  async (status) => {
    fixture([], status);
    await expect(reactions.set(command)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(writes()).toHaveLength(0);
    expect(state.queries).toHaveLength(1);
  },
);
it("denies self reactions and deleted accounts while allowing removal of old self votes", async () => {
  fixture([], "published", "actor");
  await expect(reactions.set(command)).rejects.toMatchObject({ code: "REACTION_SELF" });
  expect(writes()).toHaveLength(0);
  fixture([["old", "👍"]], "published", "actor");
  await expect(reactions.set({ ...command, reaction: null })).resolves.toHaveProperty(
    "changed",
    true,
  );
  state.queries = [];
  fixture();
  state.rows[1] = [];
  await expect(reactions.set(command)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  expect(writes()).toHaveLength(0);
});
it("allows actor-scoped removal from an archived or missing target", async () => {
  fixture([["old", "❤️"]], "archived");
  expect(
    await reactions.set({
      actorId: "actor",
      contentId: "content",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).toMatchObject({ slug: null, reaction: null, changed: true });
  state.queries = [];
  state.rows = [[], [["actor"]], [["orphan", "👍"]]];
  await expect(
    reactions.set({
      actorId: "actor",
      contentId: "missing",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).resolves.toMatchObject({ slug: null, changed: true });
  expect(writes().map((q) => q.sql.split(" ")[0])).toEqual(["delete", "insert"]);
});
it("does not touch or report another private target when no own reaction exists", async () => {
  fixture([], "draft");
  expect(
    await reactions.set({
      actorId: "actor",
      contentId: "content",
      reaction: null,
      reactionId: "new",
      auditId: "audit",
    }),
  ).toEqual({
    contentId: "content",
    slug: null,
    reaction: null,
    counts: { helpful: 0, thanks: 0, insight: 0 },
    changed: false,
  });
  expect(writes()).toHaveLength(0);
  expect(state.notice).not.toHaveBeenCalled();
});
it("propagates audit and inbox failures rather than confirming incomplete persistence", async () => {
  fixture();
  state.failAudit = true;
  await expect(reactions.set(command)).rejects.toMatchObject({
    cause: { message: "audit failure" },
  });
  fixture();
  state.failAudit = false;
  state.notice.mockRejectedValueOnce(new Error("inbox failure"));
  await expect(reactions.set(command)).rejects.toThrow("inbox failure");
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
it("rejects ambiguous scope and adding a reaction via private cleanup", async () => {
  for (const input of [
    { ...command, contentId: "content" },
    { ...command, slug: undefined, contentId: "content" },
    { ...command, slug: undefined },
  ])
    await expect(reactions.set(input)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.queries).toHaveLength(0);
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
