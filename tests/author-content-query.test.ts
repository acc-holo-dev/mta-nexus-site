import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { createAuthorContentQueryDbMock } = await import("./helpers/author-content-query-harness");
  return createAuthorContentQueryDbMock();
});

import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import {
  installAuthorContentQueryHooks,
  authorContentQueryState as state,
} from "./helpers/author-content-query-harness";

installAuthorContentQueryHooks();

it("bounds author lists, retains stable tie ordering, and does not select the body", async () => {
  await authorContentRepository.pageByAuthor("usr_1", {
    page: 2,
    query: "%_",
    status: "draft",
    type: "article",
  });
  const query = state.queries[0];
  expect(query.sql).toContain('"content"."author_id" =');
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.sql.split(" from ")[0]).not.toContain('"body"');
  expect(query.params).toEqual(["usr_1", "draft", "article", "%\\%\\_%", "%\\%\\_%", 21, 20]);
});
it("restricts public catalogs to published content and abbreviates body projections", async () => {
  await authorContentRepository.pagePublic(["post", "question"], {
    page: 2,
    status: "draft",
    query: "Lua",
  });
  expect(state.queries[0].sql).toContain('left("body", 350)');
  expect(state.queries[0].sql).toContain("content.server_id");
  expect(state.queries[0].sql).toContain("content.product_id");
  expect(state.queries[0].sql).toContain("\"visibility\" = 'public'");
  expect(state.queries[0].sql).toContain('"builds"."scan_status"');
  expect(state.queries[0].params).toContain("published");
  expect(state.queries[0].params).not.toContain("draft");
  expect(state.queries[0].params).toEqual([
    "published",
    "clean",
    "published",
    "post",
    "question",
    "%Lua%",
    "%Lua%",
    "%Lua%",
    "%Lua%",
    25,
    24,
  ]);
  expect(state.queries[0].sql).toContain(
    'coalesce("content"."published_at", "content"."created_at") desc, "content"."id" desc',
  );
});
it("returns empty without querying an incompatible catalog type", async () => {
  expect(await authorContentRepository.pagePublic(["article"], { type: "question" })).toEqual({
    items: [],
    page: 1,
    hasMore: false,
  });
  expect(state.queries).toHaveLength(0);
});
