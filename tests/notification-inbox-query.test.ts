import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      return { rows: state.rows };
    }),
  };
});
import { NotificationRepository } from "../packages/db/src/repositories/notifications";
const repository = new NotificationRepository();
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});

const limits = [
  [Number.NaN, 50, 32],
  [Infinity, 50, 32],
  [-Infinity, 50, 32],
  [-5, 1, 1],
  [0, 1, 1],
  [1.9, 1, 1],
  [20, 20, 20],
  [10000, 100, 64],
];
describe("notification inbox SQL", () => {
  it.each(limits)("bounds inbox limit %s to %s", async (input, inbox) => {
    await repository.listByUser("user_' --", input);
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].params).toEqual(["user_' --", inbox]);
    expect(state.queries[0].sql).toContain(
      'order by "notifications"."created_at" desc, "notifications"."id" desc',
    );
    expect(state.queries[0].sql).not.toContain("user_' --");
    expect(state.queries[0].sql).not.toContain('"is_read" = false');
  });
  it.each(limits)(
    "bounds review limit %s with exact bound build scope",
    async (input, _inbox, reviews) => {
      const prefix = "ntf_build_review_build_%'_";
      await repository.listBuildReviewByBuildId("build_%'", input);
      expect(state.queries[0].params).toEqual([prefix.length, prefix, reviews]);
      expect(state.queries[0].sql).toContain('left("notifications"."id", $1) = $2');
      expect(state.queries[0].sql).toContain("->>'kind' = 'build_review'");
      expect(state.queries[0].sql).toContain('"created_at" desc, "notifications"."id" desc');
      expect(state.queries[0].sql).not.toContain(prefix);
    },
  );
  it("keeps finite default limits and a literal unread predicate", async () => {
    await repository.listByUser("recipient", undefined, true);
    await repository.listBuildReviewByBuildId("build");
    expect(state.queries[0].params).toEqual(["recipient", 50]);
    expect(state.queries[0].sql).toContain('"notifications"."is_read" = false');
    expect(state.queries[1].params.at(-1)).toBe(32);
  });
  it("counts only one recipient's unread rows without a predicate parameter", async () => {
    state.rows = [["12"]];
    expect(await repository.countUnread("recipient")).toBe(12);
    expect(state.queries[0].params).toEqual(["recipient"]);
    expect(state.queries[0].sql).toContain('"notifications"."is_read" = false');
    expect(state.queries[0].sql).toContain('"notifications"."recipient_id" = $1');
  });
  it("marks only the recipient's unread rows and binds the written value", async () => {
    await repository.markAllAsRead("recipient");
    expect(state.queries[0].params).toEqual([true, "recipient"]);
    expect(state.queries[0].sql).toContain('"notifications"."recipient_id" = $2');
    expect(state.queries[0].sql).toContain('"notifications"."is_read" = false');
  });
});
