import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ queries: [] as { sql: string; params: unknown[] }[] }));
vi.mock("../../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  return {
    db: drizzle(async (sql, params) => {
      state.queries.push({ sql, params });
      return { rows: [] };
    }),
  };
});

import { ContentRepository } from "../../packages/db/src/repositories/content";

it("checks topic slug and ownership together in one bounded query", async () => {
  expect(
    await new ContentRepository().findOwnCommunityTopicBySlug("my-topic-123", "usr_a"),
  ).toBeNull();
  expect(state.queries).toHaveLength(1);
  const query = state.queries[0];
  expect(query.sql).toContain('"content"."author_id"');
  expect(query.sql).toContain('"content"."slug"');
  expect(query.sql).toContain('"content"."type"');
  expect(query.sql).toContain("limit");
  expect(query.params).toEqual(
    expect.arrayContaining(["my-topic-123", "usr_a", "post", "question"]),
  );
});
