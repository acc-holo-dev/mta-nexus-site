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
import {
  installAuthorPublicationDeskQueryHooks,
  authorPublicationDeskQueryAudit as audit,
  authorPublicationDeskQueryFull as full,
  authorPublicationDeskQueryNext as next,
  authorPublicationDeskQueryRevision as revision,
  authorPublicationDeskQueryState as state,
} from "./helpers/author-publication-desk-query-harness";

installAuthorPublicationDeskQueryHooks();

it("locks the author row first and restores only a proven version to a private draft", async () => {
  state.rows = [[full()], [["article"]], [full({ status: "draft", publishedAt: null }, next)], []];
  expect(await repo.restore("article", "actor", revision, audit)).toEqual({
    id: "article",
    status: "draft",
    revision: next,
  });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[0].params).toEqual(expect.arrayContaining(["article", "actor", "article"]));
  expect(state.queries[1].sql).toContain("restoreRevision");
  expect(state.queries[1].sql).toContain("content.archived_by_author");
  expect(state.queries[1].sql).toContain("staff_archive");
  const set = state.queries[2].sql.split(" set ")[1].split(" where ")[0];
  expect(set).toContain('"status"');
  expect(set).toContain('"published_at"');
  expect(set).not.toMatch(/body|slug|title|view_count|like_count|comment_count/u);
  expect(state.queries[3].params).toContain("content.restored_by_author");
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "article", status: "draft" }),
    "actor",
    "restored",
    "audit",
  );
});

it.each([
  { row: full({ status: "published" }), code: "CONFLICT", queries: 1 },
  { row: full({}, next), code: "CONFLICT", queries: 1 },
  { row: full(), code: "PUBLICATION_RESTORE_DENIED", queries: 2 },
])(
  "rejects stale states or unproven archives before writes ($code)",
  async ({ row, code, queries }) => {
    state.rows = [[row], []];
    await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({ code });
    expect(state.queries).toHaveLength(queries);
    expect(state.notice).not.toHaveBeenCalled();
  },
);

it.each([null, "member", "owner"])(
  "rechecks revoked organizational rights under shared locks (%s)",
  async (role) => {
    state.rows = [
      [full({ organizationId: "org" })],
      [["article"]],
      [["different-owner"]],
      role ? [[role]] : [],
    ];
    await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries.at(-1)?.sql).toContain("for share");
    expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  },
);

it("reuses server delegation authority and propagates mandatory audit/notice failures", async () => {
  state.rows = [[full({ serverId: "server" })], [["article"]]];
  state.serverAccess.mockRejectedValueOnce(new Error("revoked"));
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toThrow("revoked");
  expect(state.serverAccess).toHaveBeenCalledWith(expect.anything(), "server", "actor");
  expect(state.queries).toHaveLength(2);
  state.rows = [[full()], [["article"]], [full({ status: "draft" }, next)]];
  state.failAudit = true;
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toMatchObject({
    cause: { message: "audit failed" },
  });
  state.failAudit = false;
  state.rows = [[full()], [["article"]], [full({ status: "draft" }, next)], []];
  state.notice.mockRejectedValueOnce(new Error("notice failed"));
  await expect(repo.restore("article", "actor", revision, audit)).rejects.toThrow("notice failed");
});

it("records exact recovery proof only for a new author archive and keeps private proof out of the content response", async () => {
  state.rows = [[full({ status: "published" }).slice(0, -1)], [full({}, next)], []];
  const result = await repo.mutate("article", "actor", new Date(revision), "published", null, {
    ...audit,
    action: "content.archived_by_author",
  });
  expect(result).not.toHaveProperty("archiveRevision");
  // restoreRevision is appended in SQL via to_char so micros match recoverable().
  expect(state.queries[2].params).toContain(JSON.stringify({ from: "published", to: "archived" }));
  expect(state.queries[2].sql).toContain("jsonb_build_object");
  expect(state.queries[2].sql).toContain("restoreRevision");
  expect(state.queries[2].sql).toContain("to_char");
  expect(state.queries[2].params).not.toContain(
    JSON.stringify({ from: "published", to: "archived", restoreRevision: next }),
  );
});
