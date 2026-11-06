import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { organizationPublicationHistoryQueryState } = await import(
    "./helpers/organization-publication-history-query-harness"
  );
  return { publicationNotice: organizationPublicationHistoryQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createOrganizationPublicationHistoryQueryDbMock } = await import(
    "./helpers/organization-publication-history-query-harness"
  );
  return createOrganizationPublicationHistoryQueryDbMock();
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import {
  installOrganizationPublicationHistoryQueryHooks,
  organizationPublicationHistoryQueryAudit as audit,
  organizationPublicationHistoryQueryFull as full,
  organizationPublicationHistoryQueryNext as next,
  organizationPublicationHistoryQueryOrg as org,
  organizationPublicationHistoryQueryState as state,
  organizationPublicationHistoryQueryTime as time,
  organizationPublicationHistoryQueryWrites as writes,
} from "./helpers/organization-publication-history-query-harness";

installOrganizationPublicationHistoryQueryHooks();

it.each(["owner", "admin"])(
  "restores another author's proven team archive through live %s authority to draft",
  async (role) => {
    state.rows = [
      [full()],
      [org(role === "owner" ? "actor" : "owner")],
      ...(role === "admin" ? [[["admin"]]] : []),
      [["post"]],
      [full({ status: "draft", publishedAt: null }, next)],
    ];
    expect(await repo.restore("post", "actor", time, audit, "org")).toEqual({
      id: "post",
      organizationId: "org",
      status: "draft",
      revision: next,
    });
    expect(state.queries[0].sql).toContain("for update");
    expect(state.queries[1].sql).toContain("for share");
    const proof = state.queries.find((query) => query.sql.includes("staff_archive"));
    if (!proof) throw Error("Missing recovery proof");
    expect(proof.sql).toContain("content.archived_by_organization");
    expect(proof.sql).toContain("restoreRevision");
    expect(proof.params).toContain("org");
    expect(proof.sql).not.toContain('"audit_events"."actor_id" =');
    const mutation = state.queries.find((query) => query.sql.startsWith('update "content"'));
    if (!mutation) throw Error("Missing draft mutation");
    expect(mutation.params).toContain("draft");
    expect(mutation.sql.split(" set ")[1].split(" where ")[0]).not.toMatch(
      /body|author_id|organization_id|comment_count/u,
    );
    expect(state.queries.at(-1)?.params).toContain(
      JSON.stringify({ from: "archived", to: "draft", organizationId: "org" }),
    );
    expect(state.notice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: "original-author", status: "draft", publishedAt: null }),
      "actor",
      "restored",
      "audit",
    );
  },
);
it.each([null, "developer", "member", "owner"])(
  "blocks revoked restoration rights (%s) before recovery proof or writes",
  async (role) => {
    state.rows = [[full()], [org("owner")], role ? [[role]] : []];
    await expect(repo.restore("post", "actor", time, audit, "org")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(writes()).toHaveLength(0);
    expect(state.queries).toHaveLength(3);
    expect(state.queries[2].sql).toContain("for share");
  },
);
it.each(["legacy", "stale", "published"])(
  "protects unavailable archive state (%s) without mutation",
  async (kind) => {
    state.rows = [
      [
        full(
          { status: kind === "published" ? "published" : "archived" },
          kind === "stale" ? next : time,
        ),
      ],
      [org()],
      [],
    ];
    await expect(repo.restore("post", "actor", time, audit, "org")).rejects.toMatchObject({
      code: kind === "legacy" ? "PUBLICATION_RESTORE_DENIED" : "CONFLICT",
    });
    expect(writes()).toHaveLength(0);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
it("requires both recovery audit and notification success in the caller transaction", async () => {
  const prepare = () => {
    state.rows = [[full()], [org()], [["post"]], [full({ status: "draft" }, next)]];
  };
  prepare();
  state.failAudit = true;
  await expect(repo.restore("post", "actor", time, audit, "org")).rejects.toMatchObject({
    cause: { message: "audit failure" },
  });
  expect(state.notice).not.toHaveBeenCalled();
  state.failAudit = false;
  prepare();
  state.notice.mockRejectedValueOnce(Error("notice failure"));
  await expect(repo.restore("post", "actor", time, audit, "org")).rejects.toThrow("notice failure");
});
it("records exact team recovery proof when archiving and never changes the original author", async () => {
  state.rows = [[full({ status: "published" }).slice(0, -1)], [org()], [full({}, next)]];
  await repo.mutate(
    "post",
    "actor",
    new Date(time),
    "published",
    null,
    { ...audit, action: "content.archived_by_organization" },
    "org",
  );
  expect(state.queries.at(-1)?.params).toContain(
    JSON.stringify({
      organizationId: "org",
      from: "published",
      to: "archived",
    }),
  );
  expect(state.queries.at(-1)?.sql).toContain("jsonb_build_object");
  expect(state.queries.at(-1)?.sql).toContain("restoreRevision");
  expect(state.queries.at(-1)?.sql).toContain("to_char");
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ authorId: "original-author" }),
    "actor",
    "archived",
    "audit",
  );
});
