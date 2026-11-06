import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationContentQueryDbMock } = await import(
    "./helpers/organization-content-query-harness"
  );
  return createOrganizationContentQueryDbMock();
});

import { authorContentRepository as author } from "../packages/db/src/repositories/author-content";
import { contentRepository } from "../packages/db/src/repositories/content";
import { organizationContentRepository as team } from "../packages/db/src/repositories/organization-content";
import {
  installOrganizationContentQueryHooks,
  organizationContentQueryAudit as audit,
  organizationContentQueryFields as fields,
  organizationContentQueryLater as later,
  organizationContentQueryOrg as org,
  organizationContentQueryPublication as publication,
  organizationContentQueryState as state,
  organizationContentQueryTime as time,
  organizationContentQueryWrites as writes,
} from "./helpers/organization-content-query-harness";

installOrganizationContentQueryHooks();

it("uses the shared author mutation, content-first lock order and live team rights without replacing attribution or counters", async () => {
  state.rows = [
    [publication()],
    [org("actual-owner")],
    [["admin"]],
    [publication({ ...fields, status: "draft", updatedAt: later })],
  ];
  const result = await author.mutate(
    "content",
    "actor",
    new Date(time),
    "published",
    fields,
    audit,
    "org",
  );
  expect(result).toMatchObject({ authorId: "original", status: "draft", commentCount: 4 });
  expect(state.queries[0].params).toEqual(["content", "org", 1]);
  expect(state.queries.slice(0, 3).map((q) => q.sql)).toEqual([
    expect.stringContaining("for update"),
    expect.stringContaining("for share"),
    expect.stringContaining("for share"),
  ]);
  const set = writes()[0].sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toMatch(/author_id|organization_id|server_id|product_id|comment_count|slug/u);
  expect(set).toContain("interval '1 millisecond'");
  expect(writes()[1].params).toContain(
    JSON.stringify({ organizationId: "org", from: "published", to: "draft" }),
  );
});
it.each(["member", "developer", "owner", null])(
  "rechecks revoked organization write rights %s before updates or audit",
  async (role) => {
    state.rows = [[publication()], [org("actual-owner")], role ? [[role]] : []];
    await expect(
      author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes()).toHaveLength(0);
  },
);
it.each([
  { status: "archived", code: "CONTENT_ARCHIVED" },
  { updatedAt: later, code: "CONFLICT" },
  { status: "draft", code: "CONFLICT" },
])("protects archive and observed content state %j", async ({ code, ...extra }) => {
  state.rows = [[publication(extra)], [org()]];
  await expect(
    author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
  ).rejects.toMatchObject({ code });
  expect(writes()).toHaveLength(0);
});
it("creates in the requested organization and current actor regardless of supplied persistence fields", async () => {
  const expiry = new Date(Date.now() + 60_000).toISOString();
  state.rows = [
    [org()],
    [["actor"]],
    [["ses", expiry]],
    [publication({ authorId: "actor", status: "draft" })],
    [["ses", expiry]],
  ];
  await team.create(
    "org",
    "actor",
    {
      ...fields,
      id: "content",
      slug: "new",
      type: "article",
      status: "draft",
      authorId: "victim",
      organizationId: "foreign",
      viewCount: 0,
      likeCount: 0,
      commentCount: 0,
    },
    audit,
    "session-token",
  );
  expect(state.queries[0].sql).toContain("for update");
  expect(writes()[0].params).toContain("actor");
  expect(writes()[0].params).toContain("org");
  expect(writes()[0].params).not.toContain("victim");
  expect(writes()[0].params).not.toContain("foreign");
  expect(writes()[1].sql).toContain('"audit_events"');
});
it("does not confirm a team edit when audit fails", async () => {
  state.rows = [[publication()], [org()], [publication({ status: "draft", updatedAt: later })]];
  state.failAudit = true;
  await expect(
    author.mutate("content", "actor", new Date(time), "published", fields, audit, "org"),
  ).rejects.toMatchObject({ cause: expect.objectContaining({ message: "audit failure" }) });
});
it("rechecks organization publication rights inside legacy content creation instead of trusting a route precheck", async () => {
  state.rows = [[["org", "actual-owner"]], [["actor", "user"]], [["org", "owner", []]]];
  await expect(
    contentRepository.createWithAudit(
      {
        ...fields,
        id: "content",
        slug: "new",
        type: "post",
        status: "published",
        authorId: "actor",
        organizationId: "org",
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
      },
      audit,
      "token",
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(writes()).toHaveLength(0);
});
