import type { User } from "@nexus/domain";
import { beforeEach, expect, it, vi } from "vitest";
import { parseAuthorPublicationDeskQuery } from "../apps/web/src/lib/author-publication-desk-contract";

const state = vi.hoisted(() => ({
  desk: vi.fn(),
  history: vi.fn(),
  restore: vi.fn(),
  feed: vi.fn(),
}));
vi.mock("@nexus/db", () => ({
  authorContentRepository: { desk: state.desk, history: state.history, restore: state.restore },
  contentRepository: {},
  organizationContentRepository: {},
  serverContentRepository: {},
  publicationFeedRepository: { page: state.feed },
}));
vi.mock("@nexus/security", () => ({ generateId: () => "audit_generated" }));

import { authorContentService as author } from "../apps/web/src/lib/services/author-content-service";
import { publicationFeedService as feed } from "../apps/web/src/lib/services/publication-feed-service";

const actor = { id: "actor" } as User,
  revision = "2026-10-11T00:00:00.123456Z";
beforeEach(() => vi.clearAllMocks());
it("projects only author summaries and safe public context links", async () => {
  state.desk.mockResolvedValue({
    items: [
      {
        id: "article",
        slug: "article",
        title: "Title",
        type: "article",
        status: "archived",
        excerpt: "Excerpt",
        updatedAt: revision,
        commentCount: -1,
        source: "personal",
        recoverable: true,
        tags: ["lua"],
        organizationName: "Team",
        organizationSlug: "a/b",
        serverName: null,
        serverSlug: null,
        body: "Private full body",
        authorId: "private-id",
        email: "secret@example.test",
      },
    ],
    olderCursor: null,
    newerCursor: null,
  });
  const filters = parseAuthorPublicationDeskQuery(new URLSearchParams());
  if (!filters) throw Error("Missing filters");
  const result = await author.desk(actor, filters);
  expect(state.desk).toHaveBeenCalledWith("actor", filters);
  expect(result.items[0]).toMatchObject({
    organization: { href: "/organizations/a%2Fb" },
    server: null,
    commentCount: 0,
    updatedAt: revision,
  });
  expect(JSON.stringify(result)).not.toContain("private-id");
  expect(JSON.stringify(result)).not.toContain("secret@example.test");
  expect(JSON.stringify(result)).not.toContain("Private full body");
});
it("shows narrow history categories without moderator identities or notes", async () => {
  state.history.mockResolvedValue({
    item: { id: "article", title: "Title", status: "archived", revision, recoverable: false },
    events: [
      {
        id: "audit",
        action: "content.archived",
        createdAt: revision,
        from: "published",
        to: "archived",
        actorId: "private-staff",
        notes: "private reason",
        ipAddress: "secret-ip",
      },
      {
        id: "team",
        action: "content.edited_by_organization",
        createdAt: revision,
        from: "published",
        to: "draft",
      },
      {
        id: "author",
        action: "content.restored_by_author",
        createdAt: revision,
        from: "archived",
        to: "draft",
      },
    ],
    olderCursor: null,
  });
  const result = await author.history("article", actor, { cursor: undefined });
  expect(result.events.map((event) => [event.kind, event.actor])).toEqual([
    ["archived", "moderation"],
    ["edited", "team"],
    ["restored", "author"],
  ]);
  expect(JSON.stringify(result)).not.toMatch(/private-staff|private reason|secret-ip/u);
});
it("generates a trusted author audit and passes only the exact observed revision to restoration", async () => {
  state.restore.mockResolvedValue({ id: "article", status: "draft", revision });
  expect(await author.restore("article", { expectedRevision: revision }, actor)).toEqual({
    id: "article",
    status: "draft",
    revision,
  });
  expect(state.restore).toHaveBeenCalledWith(
    "article",
    "actor",
    revision,
    expect.objectContaining({
      id: "audit_generated",
      actorId: "actor",
      actorType: "user",
      action: "content.restored_by_author",
    }),
  );
});
it.each([null, {}, { expectedRevision: revision, authorId: "other" }, { expectedRevision: "bad" }])(
  "rejects unsafe recovery command %j before storage",
  async (input) => {
    await expect(author.restore("article", input, actor)).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
    });
    expect(state.restore).not.toHaveBeenCalled();
  },
);
it.each(["a/b", "", "x".repeat(129)])(
  "rejects private publication identifier %s before queries",
  async (id) => {
    await expect(author.history(id, actor, { cursor: undefined })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(author.restore(id, { expectedRevision: revision }, actor)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(state.history).not.toHaveBeenCalled();
    expect(state.restore).not.toHaveBeenCalled();
  },
);
it("binds feed continuation to the exact selected follow as well as the session", async () => {
  state.feed.mockResolvedValue({
    items: [],
    hasMore: true,
    nextCursor: { createdAt: revision, id: "last" },
    previousCursor: null,
  });
  const query = {
    query: "",
    source: "server" as const,
    target: "selected",
    type: undefined,
    cursor: undefined,
  };
  const page = await feed.page({ kind: "following", actorId: "actor" }, query),
    cursor = JSON.parse(page.nextCursor ?? "");
  for (const changed of [
    { ...query, target: "other", cursor },
    { ...query, source: "user" as const, cursor },
  ])
    await expect(feed.page({ kind: "following", actorId: "actor" }, changed)).rejects.toMatchObject(
      { code: "INVALID_CURSOR" },
    );
  await expect(
    feed.page({ kind: "following", actorId: "foreign" }, { ...query, cursor }),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.feed).toHaveBeenCalledTimes(1);
});
it("never broadens a targeted following request into public or commercial scope", async () => {
  await expect(
    feed.page(
      { kind: "server", id: "server" },
      { query: "", source: undefined, target: "server", type: undefined, cursor: undefined },
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  await expect(
    feed.page(
      { kind: "following", actorId: "actor" },
      { query: "", source: "product", target: "resource", type: undefined, cursor: undefined },
    ),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.feed).not.toHaveBeenCalled();
});
