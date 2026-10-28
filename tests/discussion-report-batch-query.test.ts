import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/initiating-session", () => ({
  lockInitiatingSession: vi.fn(),
}));

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failAudit: false,
  notice: vi.fn(),
  reportNotice: vi.fn(),
}));
vi.mock("../packages/db/src/repositories/discussion-moderation-notice", () => ({
  discussionModerationNotice: state.notice,
}));
vi.mock("../packages/db/src/repositories/notifications", () => ({
  notificationRepository: {
    createWithPushOutboxWithin: state.reportNotice,
  },
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
          return (callback: (tx: typeof database) => unknown) => callback(database);
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { communityReportsRepository as repo } from "../packages/db/src/repositories/community-reports";

const time = "2026-10-11T00:00:00.123456Z",
  digest = createHash("sha256").update("Complete comment").digest("hex");
const input = {
  items: [
    { id: "b", expectedStatus: "under_review" as const },
    { id: "a", expectedStatus: "open" as const },
  ],
  action: "resolve" as const,
  notes: "Recorded decision",
};
const rows = (
  options: {
    role?: string;
    finalRole?: string;
    textDigest?: string;
    reportDigest?: string;
    status?: string;
    missing?: boolean;
    removed?: boolean;
  } = {},
) => {
  state.rows = [
    [[options.role ?? "moderator"]],
    [["post", "archived", "Title"]],
    options.removed ? [] : [["comment", "Preview", true, options.textDigest ?? digest]],
    ...(options.removed ? [[["proof"]]] : []),
    [[options.finalRole ?? "moderator"]],
    options.missing
      ? [["a", "open", "spam", "Reason", time, "a".repeat(64), "reporter-a"]]
      : [
          [
            "a",
            options.status ?? "open",
            "spam",
            "Reason",
            time,
            options.reportDigest ?? "a".repeat(64),
            "reporter-a",
          ],
          ["b", "under_review", "spam", "Reason", time, "b".repeat(64), "reporter-b"],
        ],
  ];
};
const writes = () => state.queries.filter((query) => /^(insert|update|delete)/u.test(query.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.failAudit = false;
  state.reportNotice.mockReset().mockResolvedValue({ notification: null });
});
it("previews exact selected report states after live role and content-first locks, without mutation or private fields", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  expect(preview.items.map((item) => [item.id, item.before, item.after])).toEqual([
    ["a", "open", "resolved"],
    ["b", "under_review", "resolved"],
  ]);
  expect(preview.comment).toMatchObject({ text: "Preview", truncated: true });
  expect(JSON.stringify(preview)).not.toMatch(/reporterId|reporter-a|digest|moderatorNotes/u);
  expect(writes()).toHaveLength(0);
  expect(state.queries[0].sql).not.toContain("for share");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain('"comments"."product_id" is null');
  expect(state.queries[3].sql).toContain("for share");
  expect(state.queries[4].sql).toContain('order by "reports"."id" asc');
  expect(state.queries[4].params).toEqual(["comment", "comment", "a", "b"]);
  expect(state.queries[4].sql).not.toContain("offset");
});
it("changes all and only reviewed identities in one update and one mandatory audit insertion", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  state.queries = [];
  rows();
  state.rows.push([
    ["b", "resolved"],
    ["a", "resolved"],
  ]);
  const result = await repo.decideDiscussionBatch(
    "staff",
    "post",
    "comment",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b"],
    "session",
  );
  expect(result).toMatchObject({
    contentId: "post",
    commentId: "comment",
    action: "resolve",
    items: [
      { id: "a", status: "resolved", reporterId: "reporter-a" },
      { id: "b", status: "resolved" },
    ],
  });
  expect(writes()).toHaveLength(2);
  expect(state.queries[4].sql).toContain("for update");
  const update = writes()[0];
  expect(update.sql).toContain('"reports"."target_id"');
  expect(update.params.slice(-4)).toEqual(["comment", "comment", "a", "b"]);
  expect(writes()[1].params).toContain("report.resolve");
  expect(writes()[1].params).toContain(
    JSON.stringify({
      notes: input.notes,
      previousStatus: "open",
      status: "resolved",
      removedCommentId: null,
      contentId: "post",
      commentId: "comment",
      previewRevision: preview.previewRevision,
      batchSize: 2,
    }),
  );
  expect(
    state.queries.some(
      (query) => query.sql.startsWith("delete") || query.sql.startsWith('update "content"'),
    ),
  ).toBe(false);
});
it("locks the entire reporter audience before the first queue admission, independently of report order", async () => {
  const inverseAudience = () => {
    rows();
    state.rows[4][0][6] = "z-reporter";
    state.rows[4][1][6] = "a-reporter";
  };
  inverseAudience();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  state.queries = [];
  inverseAudience();
  state.rows.push([
    ["a", "resolved"],
    ["b", "resolved"],
  ]);
  state.reportNotice.mockImplementation(async () => {
    const locks = state.queries.filter((query) => query.sql.includes("pg_advisory_xact_lock"));
    expect(locks.map((query) => query.params[0])).toEqual([
      "nexus:notification-preference:v1:a-reporter",
      "nexus:notification-preference:v1:z-reporter",
    ]);
    return { notification: null };
  });
  await repo.decideDiscussionBatch(
    "staff",
    "post",
    "comment",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b"],
    "session",
  );
  expect(state.reportNotice).toHaveBeenCalledTimes(2);
});
it.each(["actor", "publication", "comment", "notes", "action", "text", "report"])(
  "rejects changed reviewed context (%s) before any write",
  async (changed) => {
    rows();
    const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
    state.queries = [];
    rows({
      textDigest: changed === "text" ? "c".repeat(64) : digest,
      reportDigest: changed === "report" ? "d".repeat(64) : "a".repeat(64),
    });
    await expect(
      repo.decideDiscussionBatch(
        changed === "actor" ? "foreign" : "staff",
        changed === "publication" ? "foreign" : "post",
        changed === "comment" ? "foreign" : "comment",
        {
          ...input,
          notes: changed === "notes" ? "Changed reason" : input.notes,
          action: changed === "action" ? "dismiss" : "resolve",
          previewRevision: preview.previewRevision,
        },
        ["audit-a", "audit-b"],
        "session",
      ),
    ).rejects.toMatchObject({ code: "REPORT_BATCH_CHANGED" });
    expect(writes()).toHaveLength(0);
  },
);
it.each([
  { role: "user", code: "FORBIDDEN" },
  { finalRole: "user", code: "FORBIDDEN" },
  { status: "resolved", code: "REPORT_STATE_CHANGED" },
  { missing: true, code: "NOT_FOUND" },
])("blocks revoked or stale selected cases %j", async ({ code, ...options }) => {
  rows(options);
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: "a".repeat(64) },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toMatchObject({ code });
  expect(writes()).toHaveLength(0);
});
it("supports explicit decisions for a proven removed comment, while refusing forged tombstones", async () => {
  rows({ removed: true });
  expect((await repo.previewDiscussionBatch("staff", "post", "comment", input)).comment).toBeNull();
  expect(state.queries[3].params).toEqual(
    expect.arrayContaining(["post", "comment", "content.comment_removed"]),
  );
  state.queries = [];
  rows({ removed: true });
  state.rows[3] = [];
  await expect(
    repo.previewDiscussionBatch("staff", "post", "comment", input),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(4);
});
it("propagates mandatory batch audit failure and rejects unexpected stored states", async () => {
  rows();
  const preview = await repo.previewDiscussionBatch("staff", "post", "comment", input);
  rows();
  state.rows.push([
    ["a", "resolved"],
    ["b", "resolved"],
  ]);
  state.failAudit = true;
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: preview.previewRevision },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toThrow(/audit failure|audit_events/u);
  state.failAudit = false;
  rows();
  state.rows.push([
    ["a", "dismissed"],
    ["b", "resolved"],
  ]);
  await expect(
    repo.decideDiscussionBatch(
      "staff",
      "post",
      "comment",
      { ...input, previewRevision: preview.previewRevision },
      ["audit-a", "audit-b"],
      "session",
    ),
  ).rejects.toMatchObject({ code: "REPORT_STATE_CHANGED" });
});
it.each(
  [
    [],
    [
      { id: "a", expectedStatus: "open" },
      { id: "a", expectedStatus: "open" },
    ],
    Array.from({ length: 21 }, (_, i) => ({ id: `r-${i}`, expectedStatus: "open" })),
    [{ id: "../foreign", expectedStatus: "open" }],
  ].map((items) => ({ items })),
)("bounds selection at storage boundary %j", async ({ items }) => {
  await expect(
    repo.previewDiscussionBatch("staff", "post", "comment", {
      ...input,
      items: items as unknown as typeof input.items,
    }),
  ).rejects.toMatchObject({ code: "REPORT_BATCH_INVALID" });
  expect(state.queries).toHaveLength(0);
});
