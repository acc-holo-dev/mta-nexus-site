import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: vi.fn(),
}));
vi.mock("../packages/db/src/client", async () => {
  const { createAuthorContentQueryDbMock } = await import("./helpers/author-content-query-harness");
  return createAuthorContentQueryDbMock();
});

import { authorContentRepository } from "../packages/db/src/repositories/author-content";
import { UserRepository } from "../packages/db/src/repositories/users";
import {
  installAuthorContentQueryHooks,
  authorContentQueryAudit as audit,
  authorContentQueryFields as fields,
  authorContentQueryRow as row,
  authorContentQueryState as state,
  authorContentQueryUserColumns,
  authorContentQueryVersion as version,
} from "./helpers/author-content-query-harness";

installAuthorContentQueryHooks();

it("uses a locked author match and returns editorial edits to review without counter changes", async () => {
  state.rows = [
    [row()],
    [
      row({
        ...fields,
        status: "draft",
        publishedAt: null,
        updatedAt: new Date(version.getTime() + 1).toISOString(),
      }),
    ],
    [],
  ];
  expect(
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).toMatchObject({ status: "draft", viewCount: 99, likeCount: 3, commentCount: 10 });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toEqual(["cnt_1", "usr_1", 1]);
  const set = state.queries[1].sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toContain('"author_id"');
  expect(set).not.toContain('"slug"');
  expect(set).not.toContain('"comment_count"');
  expect(set).toContain("interval '1 millisecond'");
  expect(state.queries[2].sql).toContain('insert into "audit_events"');
});
it.each(["post", "question"])("keeps published community %s edits visible", async (type) => {
  state.rows = [[row({ type })], [row({ type, status: "published" })], []];
  expect(
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).toMatchObject({ status: "published" });
  expect(state.queries[1].params).toContain("published");
});
it("rejects a stale writer version before update or audit", async () => {
  state.rows = [[row()]];
  await expect(
    authorContentRepository.mutate(
      "cnt_1",
      "usr_1",
      new Date(version.getTime() - 1),
      "published",
      fields,
      audit,
    ),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(1);
});
it("rejects a moderation transition even if its timestamp matches the submitted millisecond", async () => {
  state.rows = [[row({ status: "draft" })]];
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "CONFLICT" });
  expect(state.queries).toHaveLength(1);
});
it("rejects archived content before update or audit", async () => {
  state.rows = [[row({ status: "archived" })]];
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "CONTENT_ARCHIVED" });
  expect(state.queries).toHaveLength(1);
});
it("does not permit editing another author's record", async () => {
  await expect(
    authorContentRepository.mutate("cnt_1", "usr_other", version, "published", fields, audit),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries[0].params).toContain("usr_other");
  expect(state.queries).toHaveLength(1);
});
it.each(["admin", "developer"])(
  "rechecks the organization's %s role under shared locks",
  async (role) => {
    state.rows = [
      [row({ organizationId: "org_1" })],
      [["usr_other_owner"]],
      [[role]],
      [row({ status: "draft" })],
      [],
    ];
    await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit);
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries[2].sql).toContain("for share");
    expect(state.queries[2].params).toEqual(["org_1", "usr_1", 1]);
  },
);
it.each([null, "member", "owner"])(
  "blocks absent or revoked organizational edit rights (%s)",
  async (role) => {
    state.rows = [[row({ organizationId: "org_1" })], [["usr_other_owner"]], role ? [[role]] : []];
    await expect(
      authorContentRepository.mutate("cnt_1", "usr_1", version, "published", fields, audit),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries).toHaveLength(3);
  },
);
it("archives through a status update and an audit, preserving replies", async () => {
  state.rows = [[row()], [row({ status: "archived" })], []];
  await authorContentRepository.mutate("cnt_1", "usr_1", version, "published", null, audit);
  expect(state.queries.some((query) => query.sql.includes("delete"))).toBe(false);
  expect(state.queries[1].params).toContain("archived");
  expect(state.queries[2].params).toContain(JSON.stringify({ from: "published", to: "archived" }));
});
it("profile updates compare milliseconds and write only editable public fields with an audit", async () => {
  const fixture = {
    id: "usr_1",
    username: "writer",
    displayName: "Writer",
    email: "private@test",
    role: "user",
    isVerified: false,
    emailVerified: false,
    twoFactorEnabled: false,
    bio: null,
    avatarUrl: null,
    createdAt: version.toISOString(),
    updatedAt: new Date(version.getTime() + 1).toISOString(),
  };
  state.rows = [
    [["usr_1"]],
    [["ses_1", "2099-01-01T00:00:00.000Z"]],
    [authorContentQueryUserColumns(fixture)],
    [],
    [["ses_1", "2099-01-01T00:00:00.000Z"]],
  ];
  expect(
    await new UserRepository().updatePublicProfile(
      "usr_1",
      version,
      { displayName: "Writer", bio: "", avatarUrl: "" },
      "aud_1",
      "session-token",
    ),
  ).toMatchObject({ displayName: "Writer" });
  const update = state.queries[2];
  expect(update.sql).toContain("date_trunc('milliseconds'");
  expect(update.sql.split(" returning ")[1]).not.toContain('"password_hash"');
  const set = update.sql.split(" set ")[1].split(" where ")[0];
  expect(set).not.toContain('"role"');
  expect(set).not.toContain('"email"');
  expect(set).not.toContain('"is_verified"');
  expect(state.queries[3].params).toContain("user.profile_updated");
  expect(state.queries[4].sql).toContain('from "sessions"');
});
it("does not audit an unconfirmed profile update", async () => {
  state.rows = [[["usr_1"]], [["ses_1", "2099-01-01T00:00:00.000Z"]], []];
  expect(
    await new UserRepository().updatePublicProfile(
      "usr_1",
      version,
      { displayName: "Writer", bio: "", avatarUrl: "" },
      "aud_1",
      "session-token",
    ),
  ).toBeNull();
  expect(state.queries).toHaveLength(3);
});
