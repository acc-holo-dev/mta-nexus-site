import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { authorPublicationDeskQueryState } = await import(
    "./helpers/author-publication-desk-query-harness"
  );
  return { publicationNotice: authorPublicationDeskQueryState.notice };
});
vi.mock("../packages/db/src/repositories/server-content", async () => {
  const { authorPublicationDeskQueryState } = await import(
    "./helpers/author-publication-desk-query-harness"
  );
  return { serverContentAccess: authorPublicationDeskQueryState.serverAccess };
});
vi.mock("../packages/db/src/client", async () => {
  const { createAuthorPublicationDeskQueryDbMock } = await import(
    "./helpers/author-publication-desk-query-harness"
  );
  return createAuthorPublicationDeskQueryDbMock();
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import { publicationFeedRepository as feed } from "../packages/db/src/repositories/publication-feed";
import {
  installAuthorPublicationDeskQueryHooks,
  authorPublicationDeskQueryContext as context,
  authorPublicationDeskQueryFilters as filters,
  authorPublicationDeskQueryRevision as revision,
  authorPublicationDeskQueryState as state,
  authorPublicationDeskQuerySummary as summary,
} from "./helpers/author-publication-desk-query-harness";

installAuthorPublicationDeskQueryHooks();

it("returns a bounded private keyset desk without commercial rows, body, offset or account fields", async () => {
  state.rows = [Array.from({ length: 21 }, (_, n) => summary(`article_${21 - n}`))];
  const page = await repo.desk("actor", filters);
  expect(page.items).toHaveLength(20);
  expect(JSON.parse(page.olderCursor ?? "")).toMatchObject({
    id: "article_2",
    createdAt: revision,
    context,
    direction: "older",
  });
  expect(page.newerCursor).toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const query = state.queries[0];
  expect(query.sql).not.toContain("offset");
  expect(query.sql).toContain('order by "content"."updated_at" desc, "content"."id" desc');
  expect(query.params).toContain("actor");
  expect(query.params).toContain(21);
  expect(query.params).not.toContain("resource");
  expect(query.sql.split(" from ")[0]).not.toContain('"content"."body",');
  expect(query.sql).not.toContain('"users"');
  expect(query.sql).toContain("restoreRevision");
  expect(query.sql).toContain("staff_archive");
});

it("escapes literal full-text search, exact tags and binds all filters before the row limit", async () => {
  await repo.desk("actor_'", {
    query: "%_\\",
    tag: "LuA",
    status: "draft",
    type: "news",
    source: "organization",
  });
  const query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining(["actor_'", "draft", "news", "organization", "lua", "%\\%\\_\\\\%", 21]),
  );
  expect(query.sql).not.toContain("actor_'");
  expect(query.sql).toContain("jsonb_array_elements_text");
  expect(query.sql).toContain('left join "servers"');
  expect(query.params).toEqual(expect.arrayContaining(["public", "active"]));
});

it("selects nearest newer rows before reversing and needs no anchor lookup", async () => {
  state.rows = [[summary("near"), summary("latest")]];
  const page = await repo.desk("actor", {
    ...filters,
    cursor: { id: "removed", createdAt: revision, context, direction: "newer" },
  });
  expect(page.items.map((item) => item.id)).toEqual(["latest", "near"]);
  expect(page.newerCursor).toBeNull();
  expect(page.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain(") > (");
  expect(state.queries[0].sql).toContain('"updated_at" asc, "content"."id" asc');
});

it.each(["actor", "status", "source", "tag"])(
  "rejects desk context changes (%s) before SQL",
  async (changed) => {
    await expect(
      repo.desk(changed === "actor" ? "foreign" : "actor", {
        ...filters,
        status: changed === "status" ? "draft" : "all",
        source: changed === "source" ? "server" : "all",
        tag: changed === "tag" ? "lua" : "",
        cursor: { id: "last", createdAt: revision, context, direction: "older" },
      }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(0);
  },
);

it("checks authored scope before querying retained history and selects no private staff information", async () => {
  await expect(repo.history("article", "foreign")).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("foreign");
  state.queries = [];
  state.rows = [
    [["article", "Title", "archived", revision, false]],
    Array.from({ length: 21 }, (_, n) => [
      `audit_${n}`,
      "content.archived",
      revision,
      "published",
      "archived",
    ]),
  ];
  const page = await repo.history("article", "actor");
  expect(page.events).toHaveLength(20);
  expect(page.olderCursor).not.toBeNull();
  expect(state.queries).toHaveLength(2);
  const selected = state.queries[1].sql.split(" from ")[0];
  expect(selected).not.toMatch(/notes|actor_id|ip_address|user_agent/u);
  expect(state.queries[1].params).toContain("article");
  expect(state.queries[1].params).toContain(21);
});

it.each(["user", "organization", "server"] as const)(
  "binds exact followed %s target within the current actor's subscription subquery",
  async (source) => {
    await feed.page({ kind: "following", actorId: "actor" }, { source, target: "selected" });
    expect(state.queries).toHaveLength(1);
    expect(state.queries[0].params).toEqual(
      expect.arrayContaining(["actor", source, "selected", 21]),
    );
    expect(state.queries[0].sql).toContain('"follows"."target_id" =');
    expect(state.queries[0].sql).not.toContain("offset");
  },
);
