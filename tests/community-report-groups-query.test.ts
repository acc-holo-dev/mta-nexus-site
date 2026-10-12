import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
  failAudit: false,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failAudit && sql.startsWith('insert into "audit_events"'))
      throw Error("audit failure");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, config: unknown) => {
            state.config = config;
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { communityReportsRepository as repo } from "../packages/db/src/repositories/community-reports";

const stamp = "2026-10-12T00:00:00.123456Z",
  base = { period: "30" as const, group: "all" as const, query: "", view: "pending" as const },
  input = {
    items: [{ id: "report", expectedStatus: "open" as const }],
    action: "resolve" as const,
    notes: "Reviewed reason",
  },
  digest = "a".repeat(64);
const context = (actor = "staff", view = "pending", target = "", type = "", query = "") =>
  createHash("sha256")
    .update(
      JSON.stringify([
        1,
        `community-report-groups:${view}:${target}:${type}`,
        actor,
        actor,
        "30",
        "all",
        query,
      ]),
    )
    .digest("hex");
const cursor = { version: 1 as const, context: context(), until: stamp, id: "anchor" };
const group = (targetType = "content", targetId = "post", anchor = "anchor") => [
  targetType,
  targetId,
  anchor,
  stamp,
  stamp,
  "2",
  "1",
  "3",
  "4",
];
const publicationRows = (
  extra: {
    role?: string;
    finalRole?: string;
    digest?: string;
    reportDigest?: string;
    status?: string;
  } = {},
) => {
  state.rows = [
    [[extra.role ?? "moderator"]],
    [["post", "published", "Title", "Full publication", false, extra.digest ?? digest]],
    [[extra.finalRole ?? "moderator"]],
    [
      [
        "report",
        extra.status ?? "open",
        "abuse",
        "Reason",
        stamp,
        extra.reportDigest ?? digest,
        "private-reporter",
      ],
    ],
  ];
};
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = undefined;
  state.failAudit = false;
});
it("checks current staff, groups actual reports in SQL and resolves metadata only for the selected page", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    [group(), group("comment", "comment", "other")],
    [["post", "Publication", "published"]],
    [["comment", "post", "Publication", "Snippet", "archived"]],
  ];
  const result = await repo.groups("staff", base);
  expect(result.items).toHaveLength(2);
  expect(result.items[0]).toMatchObject({
    open: 2,
    review: 1,
    resolved: 3,
    dismissed: 4,
    target: { title: "Publication" },
  });
  expect(result.items[1].target?.text).toBe("Snippet");
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries).toHaveLength(5);
  const query = state.queries[2];
  expect(query.sql).toContain("group by");
  expect(query.sql).toContain("having count(*) filter");
  expect(query.sql).toContain("in ('content','comment')");
  expect(query.sql).not.toContain("offset");
  expect(query.params).toContain(21);
  expect(query.sql.split(' from "reports"')[0]).not.toMatch(
    /reporter_id|reason|evidence_urls|moderator_notes/u,
  );
  expect(state.queries[3].params).toContain("post");
  expect(state.queries[4].params).toContain("comment");
});
it("does not retrieve metadata for the twenty-first sentinel group", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    Array.from({ length: 21 }, (_, i) => group("content", `post-${i}`, `anchor-${i}`)),
    [],
  ];
  const result = await repo.groups("staff", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ ...cursor, id: "anchor-19" });
  expect(state.queries[3].params).not.toContain("post-20");
});
it("retains literal search, category, target and history filters with the precise window", async () => {
  state.rows = [[["moderator"]], [[stamp]], []];
  await repo.groups("staff", {
    ...base,
    view: "history",
    query: "100%_\\",
    target: "comment",
    type: "spam",
  });
  const query = state.queries[2];
  expect(query.params).toEqual(
    expect.arrayContaining([stamp, 30, "comment", "spam", "%100\\%\\_\\\\%", 21]),
  );
  expect(query.sql).toContain("in ('resolved','dismissed')");
});
it("resolves a cursor's group from scoped stored reports rather than trusting client aggregate times", async () => {
  state.rows = [
    [["moderator"]],
    [["2026-10-12T00:01:00.000000Z"]],
    [["comment", "comment", stamp]],
    [[stamp]],
    [],
  ];
  const result = await repo.groups("staff", { ...base, cursor });
  expect(result.until).toBe(stamp);
  expect(state.queries[2].params).toContain("anchor");
  expect(state.queries[3].sql).toContain("having count(*) filter");
  expect(state.queries[4].sql).toContain(") > (");
  expect(state.queries[4].params).toEqual(expect.arrayContaining([stamp, "comment"]));
});
it.each([
  { cursor: { ...cursor, context: context("other") } },
  { cursor, target: "content" as const },
  { cursor, type: "spam" },
  { cursor, view: "history" as const },
  { before: "legacy" },
])("rejects actor/filter reuse or unsupported anchors before storage %j", async (extra) => {
  await expect(repo.groups("staff", { ...base, ...extra })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it("rejects deleted anchors or groups with no remaining eligible reports", async () => {
  state.rows = [[["moderator"]], [[stamp]], []];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
  state.rows = [[["moderator"]], [[stamp]], [["content", "post", stamp]], []];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
});
it("denies a revoked moderator before aggregate, clock or metadata queries", async () => {
  state.rows = [[["user"]]];
  await expect(repo.groups("staff", base)).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries).toHaveLength(1);
});
it("expires a group whose earliest event changed rather than silently moving the pagination boundary", async () => {
  state.rows = [
    [["moderator"]],
    [[stamp]],
    [["content", "post", stamp]],
    [["2026-10-11T00:00:00.000000Z"]],
  ];
  await expect(repo.groups("staff", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_GROUPS_EXPIRED",
  });
  expect(state.queries).toHaveLength(4);
});
it("reads a bounded publication report page with literal filters and current publication context", async () => {
  state.rows = [[["moderator"]], [["post", "Title", "draft", "Body", false]], []];
  const result = await repo.publicationReports("staff", "post", {
    page: 2,
    view: "history",
    type: "spam",
    query: "100%_",
  });
  expect(result).toMatchObject({
    publication: { id: "post", status: "draft" },
    page: 2,
    view: "history",
    items: [],
  });
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining([
      "content",
      "post",
      "resolved",
      "dismissed",
      "spam",
      "%100\\%\\_%",
      21,
      20,
    ]),
  );
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
});
it("previews publication batches under shared lock ordering and binds the complete text/revision without exposing its digest", async () => {
  publicationRows();
  const result = await repo.previewPublicationBatch("staff", "post", input);
  expect(result.commentId).toBeNull();
  expect(result.publication.text).toBe("Full publication");
  expect(state.queries).toHaveLength(4);
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[1].sql).toContain("sha256(convert_to(jsonb_build_array(");
  expect(state.queries[3].params).toEqual(["content", "post", "report"]);
  expect(state.queries.some((query) => query.sql.includes('from "comments"'))).toBe(false);
  expect(JSON.stringify(result.items)).not.toContain("private-reporter");
});
it("commits all and only reviewed publication reports with one update and mandatory audit", async () => {
  publicationRows();
  const preview = await repo.previewPublicationBatch("staff", "post", input);
  state.queries = [];
  publicationRows();
  state.rows.push([["report", "resolved"]]);
  const result = await repo.decidePublicationBatch(
    "staff",
    "post",
    { ...input, previewRevision: preview.previewRevision },
    ["audit"],
  );
  expect(result.items).toEqual([
    { id: "report", status: "resolved", reporterId: "private-reporter" },
  ]);
  const writes = state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
  expect(writes).toHaveLength(2);
  expect(writes[0].params).toEqual(expect.arrayContaining(["content", "post", "report"]));
  expect(writes[1].params).toContain(
    JSON.stringify({
      notes: "Reviewed reason",
      previousStatus: "open",
      status: "resolved",
      removedCommentId: null,
      contentId: "post",
      commentId: null,
      previewRevision: preview.previewRevision,
      batchSize: 1,
    }),
  );
});
it.each(["publication", "report", "staff"])(
  "rejects a changed %s after review before writing",
  async (changed) => {
    publicationRows();
    const preview = await repo.previewPublicationBatch("staff", "post", input);
    state.queries = [];
    publicationRows(
      changed === "publication"
        ? { digest: "b".repeat(64) }
        : changed === "report"
          ? { reportDigest: "b".repeat(64) }
          : { finalRole: "user" },
    );
    await expect(
      repo.decidePublicationBatch(
        "staff",
        "post",
        { ...input, previewRevision: preview.previewRevision },
        ["audit"],
      ),
    ).rejects.toMatchObject({ statusCode: changed === "staff" ? 403 : 409 });
    expect(state.queries.some((query) => /^(insert|update|delete)/u.test(query.sql))).toBe(false);
  },
);
it("fails closed on a foreign target/report selection and mandatory audit failure", async () => {
  state.rows = [[["moderator"]], []];
  await expect(repo.previewPublicationBatch("staff", "foreign", input)).rejects.toMatchObject({
    statusCode: 404,
  });
  publicationRows();
  state.rows[3] = [];
  await expect(repo.previewPublicationBatch("staff", "post", input)).rejects.toMatchObject({
    statusCode: 404,
  });
  publicationRows();
  const preview = await repo.previewPublicationBatch("staff", "post", input);
  publicationRows();
  state.rows.push([["report", "resolved"]]);
  state.failAudit = true;
  await expect(
    repo.decidePublicationBatch(
      "staff",
      "post",
      { ...input, previewRevision: preview.previewRevision },
      ["audit"],
    ),
  ).rejects.toThrow(/audit failure|audit_events/u);
});
