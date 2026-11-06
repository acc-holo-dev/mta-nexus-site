import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/publication-notice", async () => {
  const { serverPublicationHistoryQueryState } = await import(
    "./helpers/server-publication-history-query-harness"
  );
  return { publicationNotice: serverPublicationHistoryQueryState.notice };
});
vi.mock("../packages/db/src/client", async () => {
  const { createServerPublicationHistoryQueryDbMock } = await import(
    "./helpers/server-publication-history-query-harness"
  );
  return createServerPublicationHistoryQueryDbMock();
});

import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import {
  installServerPublicationHistoryQueryHooks,
  serverPublicationHistoryQueryAudit as audit,
  serverPublicationHistoryQueryFull as full,
  serverPublicationHistoryQueryNext as next,
  serverPublicationHistoryQueryState as state,
  serverPublicationHistoryQueryTime as time,
  serverPublicationHistoryQueryWrites as writes,
} from "./helpers/server-publication-history-query-harness";

installServerPublicationHistoryQueryHooks();

it.each(["owner", "admin", "organization-owner", "delegated"])(
  "restores another author's proven archive through existing %s server authority",
  async (kind) => {
    const organizationId = ["organization-owner", "delegated"].includes(kind) ? "org" : null;
    state.rows = [
      [full()],
      [["srv", "Server", "server", kind === "owner" ? "actor" : "other", organizationId]],
      [[kind === "admin" ? "admin" : "user"]],
      ...(organizationId ? [[["org", kind === "organization-owner" ? "actor" : "other"]]] : []),
      ...(kind === "delegated" ? [[["org", "developer", ["manage_servers"]]]] : []),
      [["post"]],
      [full({ status: "draft", publishedAt: null }, next)],
    ];
    expect(await repo.restore("post", "actor", time, audit, undefined, "srv")).toEqual({
      id: "post",
      serverId: "srv",
      status: "draft",
      revision: next,
    });
    expect(state.queries[0].sql).toContain("for update");
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries[2].sql).toContain("for share");
    const proof = state.queries.find((query) => query.sql.includes("staff_archive"));
    expect(proof?.sql).toContain("content.archived_by_server");
    expect(proof?.params).toContain("srv");
    expect(proof?.sql).not.toContain('"audit_events"."actor_id" =');
    const update = state.queries.find((query) => query.sql.startsWith('update "content"'));
    expect(update?.params).toContain("draft");
    expect(update?.sql.split(" set ")[1].split(" where ")[0]).not.toMatch(
      /body|author_id|server_id|comment_count/u,
    );
    expect(state.queries.at(-1)?.params).toContain(
      JSON.stringify({ from: "archived", to: "draft", serverId: "srv" }),
    );
    expect(state.notice).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ authorId: "original", status: "draft" }),
      "actor",
      "restored",
      "audit",
    );
  },
);
it.each(["member", "developer", "owner", null])(
  "rejects nondelegated or stale organization grants (%s) before proof and writes",
  async (role) => {
    state.rows = [
      [full()],
      [["srv", "Server", "server", "actor", "org"]],
      [["user"]],
      [["org", "actual-org-owner"]],
      role ? [["org", role, []]] : [],
    ];
    await expect(
      repo.restore("post", "actor", time, audit, undefined, "srv"),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(writes()).toHaveLength(0);
    expect(state.queries.at(-1)?.sql).toContain("for share");
  },
);
it("does not grant personal server restoration to a platform moderator", async () => {
  state.rows = [[full()], [["srv", "Server", "server", "other", null]], [["moderator"]]];
  await expect(repo.restore("post", "actor", time, audit, undefined, "srv")).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  expect(writes()).toHaveLength(0);
});
it.each(["unproven", "stale", "published"])(
  "blocks unavailable archive state (%s) before mutation",
  async (kind) => {
    state.rows = [
      [
        full(
          { status: kind === "published" ? "published" : "archived" },
          kind === "stale" ? next : time,
        ),
      ],
      [["srv", "Server", "server", "actor", null]],
      [["user"]],
      [],
    ];
    await expect(
      repo.restore("post", "actor", time, audit, undefined, "srv"),
    ).rejects.toMatchObject({
      code: kind === "unproven" ? "PUBLICATION_RESTORE_DENIED" : "CONFLICT",
    });
    expect(writes()).toHaveLength(0);
  },
);
it("rejects ambiguous scopes without querying and requires the restoration audit and notice", async () => {
  await expect(repo.history("post", "actor", undefined, "org", "srv")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  await expect(repo.restore("post", "actor", time, audit, "org", "srv")).rejects.toMatchObject({
    code: "VALIDATION_ERROR",
  });
  expect(state.queries).toHaveLength(0);
  const prepare = () => {
    state.rows = [
      [full()],
      [["srv", "Server", "server", "actor", null]],
      [["user"]],
      [["post"]],
      [full({ status: "draft" }, next)],
    ];
  };
  prepare();
  state.failAudit = true;
  await expect(repo.restore("post", "actor", time, audit, undefined, "srv")).rejects.toMatchObject({
    cause: { message: "audit failure" },
  });
  state.failAudit = false;
  prepare();
  state.notice.mockRejectedValueOnce(Error("notice failed"));
  await expect(repo.restore("post", "actor", time, audit, undefined, "srv")).rejects.toThrow(
    "notice failed",
  );
});
it("records microsecond recovery proof for a new server-editor archive", async () => {
  state.rows = [
    [full({ status: "published" }).slice(0, -1)],
    [["srv", "Server", "server", "actor", null]],
    [["user"]],
    [full({}, next)],
  ];
  await repo.mutate(
    "post",
    "actor",
    new Date(time),
    "published",
    null,
    { ...audit, action: "content.archived_by_server" },
    undefined,
    "srv",
  );
  expect(state.queries.at(-1)?.params).toContain(
    JSON.stringify({ serverId: "srv", from: "published", to: "archived" }),
  );
  expect(state.queries.at(-1)?.sql).toContain("jsonb_build_object");
  expect(state.queries.at(-1)?.sql).toContain("restoreRevision");
  expect(state.queries.at(-1)?.sql).toContain("to_char");
});
