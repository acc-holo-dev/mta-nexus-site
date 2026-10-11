import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  rows: [] as unknown[][][],
  queries: [] as { sql: string; params: unknown[] }[],
  notice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/publication-notice", () => ({
  publicationNotice: state.notice,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (work: (tx: typeof database) => unknown) => work(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});
import { contentRepository } from "../packages/db/src/repositories/content";
import { content } from "../packages/db/src/schema";
const time = "2026-10-11T00:00:00.000Z";
const row = (extra: Record<string, unknown> = {}) =>
  Object.keys(getTableColumns(content)).map(
    (key) =>
      (
        ({
          id: "item",
          authorId: "author",
          title: "Draft",
          body: "Reviewed body",
          tags: [],
          slug: "draft",
          type: "article",
          status: "draft",
          createdAt: time,
          updatedAt: time,
          ...extra,
        }) as Record<string, unknown>
      )[key] ?? null,
  );
const audit = {
  id: "audit",
  actorId: "mod",
  actorType: "admin" as const,
  action: "content.published",
  targetId: "item",
  targetType: "content",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.rows = [];
  state.queries = [];
});
it("locks content then current moderator authority, versions the update and stores the notice after audit", async () => {
  state.rows = [
    [row()],
    [["moderator"]],
    [row({ status: "published", updatedAt: "2026-10-11T00:00:00.001Z" })],
  ];
  expect(
    await contentRepository.moderateStatusWithAudit(
      "item",
      "published",
      "draft",
      audit,
      new Date(time),
    ),
  ).toMatchObject({ status: "published" });
  expect(state.queries[0].sql).toContain("for update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("interval '1 millisecond'");
  expect(state.queries[3].sql).toContain('insert into "audit_events"');
  expect(state.notice).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({ id: "item" }),
    "mod",
    "published",
    "audit",
  );
});
it.each(["user", "developer", "server_owner", null])(
  "denies revoked moderator role %s before writes and notices",
  async (role) => {
    state.rows = [[row()], role ? [[role]] : []];
    await expect(
      contentRepository.moderateStatusWithAudit(
        "item",
        "published",
        "draft",
        audit,
        new Date(time),
      ),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(state.queries.some((q) => /^(update|insert)/u.test(q.sql))).toBe(false);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
it.each([{ status: "archived" }, { updatedAt: "2026-10-11T00:00:00.001Z" }])(
  "rejects status changes and draft-to-draft edits without publishing new text %j",
  async (extra) => {
    state.rows = [[row(extra)], [["admin"]]];
    expect(
      await contentRepository.moderateStatusWithAudit(
        "item",
        "published",
        "draft",
        audit,
        new Date(time),
      ),
    ).toBeNull();
    expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
    expect(state.notice).not.toHaveBeenCalled();
  },
);
