import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { createServerContentQueryPublicationNoticeMock } = await import(
    "./helpers/server-content-query-harness"
  );
  return createServerContentQueryPublicationNoticeMock();
});
vi.mock("../packages/db/src/client", async () => {
  const { createServerContentQueryDbMock } = await import("./helpers/server-content-query-harness");
  return createServerContentQueryDbMock();
});

import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import { serverContentRepository as repository } from "../packages/db/src/repositories/server-content";
import {
  installServerContentQueryHooks,
  serverContentQueryAudit as audit,
  serverContentQueryFields as fields,
  serverContentQueryRow as row,
  serverContentQueryState as state,
  serverContentQueryTime as time,
} from "./helpers/server-content-query-harness";

installServerContentQueryHooks();

it("uses the shared content-first versioned edit without replacing attribution, slug, context or counters", async () => {
  state.rows = [
    [row()],
    [["srv", "Server", "server", "actor", null]],
    [["user"]],
    [row({ status: "draft", updatedAt: "2026-10-11T00:00:00.001Z" })],
  ];
  expect(
    await authorContentRepository.mutate(
      "item",
      "actor",
      new Date(time),
      "published",
      fields,
      audit,
      undefined,
      "srv",
    ),
  ).toMatchObject({ authorId: "writer", serverId: "srv", commentCount: 4, status: "draft" });
  expect(state.queries[0].params).toEqual(["item", "srv", 1]);
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  const set = state.queries
    .find((q) => q.sql.startsWith("update"))
    ?.sql.split(" set ")[1]
    .split(" where ")[0];
  expect(set).not.toMatch(/author_id|slug|server_id|organization_id|product_id|comment_count/u);
});
it.each(["owner", "member", "developer", "moderator"])(
  "denies revoked, stale or undelegated team authority %s",
  async (role) => {
    state.rows = [
      [row()],
      [["srv", "Server", "server", null, "org"]],
      [["user"]],
      [["org", "actual-owner"]],
      [["org", role, role === "owner" ? ["manage_servers"] : []]],
    ];
    await expect(
      authorContentRepository.mutate(
        "item",
        "actor",
        new Date(time),
        "published",
        fields,
        audit,
        undefined,
        "srv",
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries.some((q) => /^(update|insert)/u.test(q.sql))).toBe(false);
  },
);
it("rechecks server management even through the original author's legacy editor", async () => {
  state.rows = [
    [row({ authorId: "actor" })],
    [["srv", "Server", "server", "new-owner", null]],
    [["user"]],
  ];
  await expect(
    authorContentRepository.mutate("item", "actor", new Date(time), "published", fields, audit),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
});
it("allows delegated server creation and forces current server context, actor, review and empty counters", async () => {
  state.rows = [
    [["srv", "Server", "server", null, "org"]],
    [["user"]],
    [["org", "owner"]],
    [["org", "member", ["manage_servers"]]],
    [["ses", new Date(Date.now() + 60_000).toISOString()]],
    [row({ authorId: "actor", organizationId: "org", status: "draft" })],
    [["ses", new Date(Date.now() + 60_000).toISOString()]],
  ];
  await repository.create(
    "srv",
    "actor",
    {
      ...fields,
      id: "item",
      slug: "new",
      authorId: "victim",
      serverId: "foreign",
      organizationId: "foreign-org",
      type: "article",
      status: "published",
      commentCount: 10,
      viewCount: 2,
      likeCount: 3,
    },
    audit,
    "session-token",
  );
  const insert = state.queries.find((q) => q.sql.startsWith('insert into "content"'));
  expect(insert?.params).toContain("srv");
  expect(insert?.params).toContain("org");
  expect(insert?.params).toContain("draft");
  expect(insert?.params).not.toContain("victim");
  expect(insert?.params).not.toContain("foreign");
  expect(insert?.params).not.toContain("foreign-org");
});
