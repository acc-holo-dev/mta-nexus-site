import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: [] as unknown[],
  failAudit: false,
  notice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw new Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { createHash } from "node:crypto";
import { authorContentRepository as repo } from "../packages/db/src/repositories/author-content";
import { content } from "../packages/db/src/schema";

const time = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.124456Z";
const full = (extra: Record<string, unknown> = {}, version = time) => [
  ...Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "post",
          serverId: "srv",
          authorId: "original",
          title: "Title",
          body: "Retained full text",
          slug: "article",
          type: "article",
          status: "archived",
          updatedAt: time,
          createdAt: time,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  ),
  version,
];
const audit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetId: "post",
  targetType: "content",
  action: "content.restored_by_server",
  details: { serverId: "srv" },
};
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
});
it("uses the existing current-server grants inside a private snapshot before a bounded shared editorial history", async () => {
  state.rows = [
    [["srv", "Server", "server"]],
    [["post", "Title", "archived", time, true]],
    Array.from({ length: 21 }, (_, i) => [
      "editor",
      "Editor",
      `event-${i}`,
      "content.archived_by_server",
      time,
      "published",
      "archived",
    ]),
  ];
  const result = await repo.history("post", "actor", undefined, undefined, "srv");
  expect(result.server).toEqual({ id: "srv", name: "Server" });
  expect(result.events).toHaveLength(20);
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
  expect(state.queries[0].sql).toContain('"organization_members"."permissions" @>');
  expect(state.queries[0].params).toContain('["manage_servers"]');
  const scope = state.queries[1];
  expect(scope.params).toEqual(expect.arrayContaining(["post", "srv", "article", "news"]));
  expect(scope.params.filter((value) => value === "post")).toHaveLength(1);
  expect(scope.sql).toContain('"content"."product_id" is null');
  expect(scope.sql).not.toContain('"content"."author_id" =');
  expect(scope.sql).toContain("content.archived_by_server");
  expect(scope.sql).toContain("staff_archive");
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    context: createHash("sha256")
      .update(JSON.stringify([1, "server-publication-history", "actor", "srv", "post"]))
      .digest("hex"),
    createdAt: time,
  });
  const selected = state.queries[2].sql.split(" from ")[0];
  expect(selected).not.toMatch(/notes|ip_address|user_agent|email/u);
  expect(selected).toContain("'content.published','content.archived'");
});
it("denies unavailable live server scope before publication/history reads and checks cursor context after authority", async () => {
  await expect(repo.history("post", "revoked", undefined, undefined, "srv")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(1);
  state.rows = [[["srv", "Server", "server"]]];
  state.queries = [];
  await expect(
    repo.history(
      "post",
      "actor",
      { id: "audit", createdAt: time, context: "a".repeat(64), direction: "older" },
      undefined,
      "srv",
    ),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
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
    JSON.stringify({ serverId: "srv", from: "published", to: "archived", restoreRevision: next }),
  );
});
