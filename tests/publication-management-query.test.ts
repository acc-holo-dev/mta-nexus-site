import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/discussion-moderation-notice", async () => {
  const { createPublicationManagementQueryNoticeMock } = await import(
    "./helpers/publication-management-query-harness"
  );
  return createPublicationManagementQueryNoticeMock();
});

vi.mock("../packages/db/src/client", async () => {
  const { createPublicationManagementQueryDbMock } = await import(
    "./helpers/publication-management-query-harness"
  );
  return createPublicationManagementQueryDbMock();
});

import { publicationFeedRepository as feed } from "../packages/db/src/repositories/publication-feed";
import {
  installPublicationManagementQueryHooks,
  publicationManagementQueryState as state,
} from "./helpers/publication-management-query-harness";

installPublicationManagementQueryHooks();

it.each(["user", "organization", "server", "product"] as const)(
  "scopes feed to actor and selected %s subscriptions in one bounded query",
  async (source) => {
    await feed.page(
      { kind: "following", actorId: "actor" },
      {
        source,
        type: "question",
        query: "%_",
        cursor: { createdAt: "2026-10-10T12:00:00.123456Z", id: "last" },
      },
    );
    expect(state.queries).toHaveLength(1);
    const query = state.queries[0];
    expect(query.params).toEqual(
      expect.arrayContaining([
        "actor",
        source,
        "question",
        "%\\%\\_%",
        "2026-10-10T12:00:00.123456Z",
        "last",
        21,
      ]),
    );
    expect(query.sql).toMatch(/order by coalesce.+ desc, "content"\."id" desc limit/u);
    expect(query.sql).toContain('"follows"."follower_id"');
    expect(query.sql).not.toContain("offset");
    expect(query.sql).toContain("US");
    expect(query.sql.split(" from ")[0]).not.toMatch(/email|password|two_factor|owner_id/u);
  },
);
it("gates server and resource affiliations before returning their metadata", async () => {
  await feed.page({ kind: "user", id: "author" });
  const query = state.queries[0];
  expect(query.sql).toContain('left join "servers"');
  expect(query.params).toEqual(
    expect.arrayContaining(["public", "active", "published", 0, "clean", "author", 21]),
  );
  expect(query.sql).toContain('"builds"."scanner"');
  expect(query.sql).not.toContain('"follows"');
});
it("returns only twenty summaries and builds continuation from exact database time", async () => {
  const time = "2026-10-10T12:00:00.123456Z";
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [
      `content-${index}`,
      "slug",
      "Title",
      "article",
      "Excerpt",
      null,
      0,
      time,
      time,
      "author",
      "writer",
      "Writer",
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ]),
  ];
  const page = await feed.page({ kind: "user", id: "author" });
  expect(page.items).toHaveLength(20);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "content-19" });
  expect(page.items[0].publishedAt.toISOString()).toBe("2026-10-10T12:00:00.123Z");
});
it.each(["user", "organization"] as const)(
  "uses narrow public identity lookup for %s",
  async (kind) => {
    await feed.resolvePublicScope(kind, "handle");
    expect(state.queries[0].params).toEqual(["handle", 1]);
    expect(state.queries[0].sql.split(" from ")[0]).not.toMatch(/email|owner_id|role|password/u);
  },
);
it("resolves servers only while active and public without exposing endpoint or ownership", async () => {
  await feed.resolvePublicScope("server", "my-server");
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toEqual(["my-server", "public", "active", 1]);
  expect(state.queries[0].sql.split(" from ")[0]).not.toMatch(
    /ip_address|port|owner|organization_id/u,
  );
});
it("filters the live public server, editorial type, exact author and literal tag before the page limit", async () => {
  await feed.page(
    { kind: "server", id: "server" },
    { type: "news", author: "Writer", tag: "%_", query: "%_" },
  );
  const query = state.queries[0];
  expect(query.params).toEqual(
    expect.arrayContaining([
      "server",
      "public",
      "active",
      "article",
      "news",
      "devlog",
      "update",
      "announcement",
      "writer",
      "%_",
      "%\\%\\_%",
      21,
    ]),
  );
  expect(query.sql).toContain('"servers"."id" =');
  expect(query.sql).toContain('lower("users"."username")');
  expect(query.sql).toContain('"users"."display_name" ilike');
  expect(query.sql).toContain("lower(tag.value)");
  expect(query.sql).toContain("limit 10");
  expect(query.sql).not.toContain("offset");
  expect(query.sql).not.toContain('coalesce("user_profile_preferences"."show_activity", true)');
});
it("seeks newer keys in ascending order and presents the nearest twenty newest-first", async () => {
  const time = "2026-10-11T00:00:00.123456Z";
  state.rows = [
    Array.from({ length: 21 }, (_, index) => [
      `content-${String(index).padStart(2, "0")}`,
      "slug",
      "Title",
      "news",
      "Excerpt",
      null,
      0,
      time,
      time,
      "author",
      "writer",
      "Writer",
      null,
      null,
      null,
      "Server",
      "server",
      null,
      null,
      [],
    ]),
  ];
  const page = await feed.page(
    { kind: "server", id: "server" },
    { cursor: { createdAt: time, id: "boundary", direction: "newer" } },
  );
  expect(state.queries[0].sql).toMatch(/\) > \(/u);
  expect(state.queries[0].sql).toMatch(/order by coalesce.+ asc, "content"\."id" asc limit/u);
  expect(page.items.map((row) => row.id)).toEqual(
    Array.from({ length: 20 }, (_, index) => `content-${String(19 - index).padStart(2, "0")}`),
  );
  expect(page.previousCursor).toEqual({ createdAt: time, id: "content-19" });
  expect(page.nextCursor).toEqual({ createdAt: time, id: "content-00" });
});
it("offers previous navigation from the first exact key of an older page", async () => {
  const time = "2026-10-11T00:00:00.123456Z";
  state.rows = [
    [
      [
        "only",
        "slug",
        "Title",
        "news",
        "Excerpt",
        null,
        0,
        time,
        time,
        "author",
        "writer",
        "Writer",
        null,
        null,
        null,
        null,
        null,
        null,
        null,
        [],
      ],
    ],
  ];
  const page = await feed.page(
    { kind: "server", id: "server" },
    { cursor: { createdAt: time, id: "older" } },
  );
  expect(page.hasMore).toBe(false);
  expect(page.previousCursor).toEqual({ createdAt: time, id: "only" });
});
