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
import { content, organizations } from "../packages/db/src/schema";

const time = "2026-10-11T00:00:00.123456Z",
  next = "2026-10-11T00:00:00.124456Z";
const org = (ownerId = "actor") =>
  Object.keys(getTableColumns(organizations)).map(
    (key) =>
      (
        ({
          id: "org",
          ownerId,
          name: "Team",
          slug: "team",
          createdAt: time,
          updatedAt: time,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
const full = (extra: Record<string, unknown> = {}, revision = time) => [
  ...Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "post",
          slug: "post",
          title: "Title",
          body: "Private full text",
          authorId: "original-author",
          organizationId: "org",
          type: "post",
          status: "archived",
          updatedAt: time,
          createdAt: time,
          publishedAt: time,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  ),
  revision,
];
const audit = {
  id: "audit",
  actorId: "actor",
  actorType: "user" as const,
  targetType: "content",
  targetId: "post",
  action: "content.restored_by_organization",
  details: { organizationId: "org" },
};
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.transactions = [];
  state.failAudit = false;
  state.notice.mockReset();
});
it("lets a current editor inspect shared history without full text, audit details or moderator identities", async () => {
  state.rows = [
    [org("owner")],
    [["admin"]],
    [["post", "Title", "archived", time, true]],
    Array.from({ length: 21 }, (_, i) => [
      "editor",
      "Editor",
      `event-${i}`,
      "content.archived_by_organization",
      time,
      "published",
      "archived",
    ]),
  ];
  const result = await repo.history("post", "actor", undefined, "org");
  expect(result.organization).toEqual({ id: "org", name: "Team" });
  expect(result.events).toHaveLength(20);
  expect(JSON.parse(result.olderCursor ?? "")).toMatchObject({
    createdAt: time,
    context: createHash("sha256")
      .update(JSON.stringify([1, "organization-publication-history", "actor", "org", "post"]))
      .digest("hex"),
  });
  const scope = state.queries[2];
  expect(scope.params).toEqual(expect.arrayContaining(["post", "org"]));
  expect(scope.sql).not.toContain('"content"."author_id" =');
  expect(scope.sql).toContain('"content"."server_id" is null');
  expect(scope.sql).toContain('"content"."product_id" is null');
  const selected = state.queries[3].sql.split(" from ")[0];
  expect(selected).not.toMatch(/details,|email|ip_address|user_agent|notes/u);
  expect(selected).toContain("'content.published','content.archived'");
  expect(state.queries[3].params).toContain("content.restored_by_organization");
});
it.each([null, "developer", "member", "owner"])(
  "denies non-editor and legacy-owner memberships (%s) before shared history",
  async (role) => {
    state.rows = [[org("owner")], role ? [[role]] : []];
    await expect(repo.history("post", "actor", undefined, "org")).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries).toHaveLength(2);
  },
);
it("rejects a personal/foreign cursor only after current team authority", async () => {
  state.rows = [[org()]];
  await expect(
    repo.history(
      "post",
      "actor",
      { id: "audit", createdAt: time, context: "a".repeat(64), direction: "older" },
      "org",
    ),
  ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  expect(state.queries).toHaveLength(1);
});
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
