import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  config: undefined as unknown,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
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

import { communityReportsRepository as reports } from "../packages/db/src/repositories/community-reports";

const stamp = "2026-10-12T00:00:00.123456Z",
  base = { period: "all" as const, group: "all" as const, query: "" },
  own = { actorId: "owner", staff: false },
  staff = { actorId: "moderator", staff: true };
const report = ["report", "comment", "private-comment", "abuse", "under_review", "owner"];
const event = (id = "event") => [
  id,
  "report.review",
  stamp,
  "open",
  "under_review",
  "staff",
  false,
];
const context = (actor = "owner", mode = "own", period = "all", group = "all") =>
  createHash("sha256")
    .update(
      JSON.stringify([1, `community-report-${mode}-history`, actor, "report", period, group, ""]),
    )
    .digest("hex");
const cursor = { version: 1 as const, context: context(), until: stamp, id: "anchor" };
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.config = undefined;
});
it("reads only the requester's report and never selects staff notes, raw details or unrelated actions", async () => {
  state.rows = [[report], [[stamp]], [event()]];
  const result = await reports.history(own, "report", base);
  expect(result).toMatchObject({
    report: { id: "report", type: "abuse", targetType: "comment", status: "under_review" },
    audience: "requester",
    hasMore: false,
    nextCursor: null,
  });
  expect(state.config).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  expect(state.queries[0].params).toEqual(["report", "owner", 1]);
  expect(state.queries[0].sql).toContain('"product_id" is null');
  expect(state.queries[2].params).toEqual(
    expect.arrayContaining([
      "report",
      "report.created",
      "report.review",
      "report.resolve",
      "report.dismiss",
      "report.remove_comment",
      stamp,
      21,
    ]),
  );
  expect(state.queries[2].sql).not.toMatch(
    /->'notes'|batchSize|ip_address|user_agent|offset|count\(/u,
  );
  expect(state.queries[2].sql).toContain("jsonb_typeof(");
  expect(JSON.stringify(result)).not.toMatch(/owner|private-comment|reporterId|notes|actorId/u);
});
it("keeps requester privacy when the same account has a moderator role but chooses its own view", async () => {
  state.rows = [[report], [[stamp]], [event()]];
  const result = await reports.history(own, "report", base);
  expect(result.items[0]).not.toHaveProperty("notes");
  expect(state.queries).toHaveLength(3);
});
it("rejects other requesters before clock or audit reads", async () => {
  state.rows = [[]];
  await expect(reports.history(own, "report", base)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(1);
});
it.each([{ rows: [] as unknown[][] }, { rows: [["user"]] }])(
  "rechecks deleted or revoked staff before reading reports: %j",
  async ({ rows }) => {
    state.rows = [rows];
    await expect(reports.history(staff, "report", base)).rejects.toMatchObject({ statusCode: 403 });
    expect(state.queries).toHaveLength(1);
  },
);
it("allows current staff and bounds notes without splitting a UTF-16 pair", async () => {
  state.rows = [
    [["moderator"]],
    [report],
    [[stamp]],
    [[...event(), `${"x".repeat(1999)}😀secret`, 20]],
  ];
  const result = await reports.history(staff, "report", base);
  expect(result.items[0]).toMatchObject({ notes: "x".repeat(1999), batchSize: 20 });
  expect(state.queries[3].sql).toContain("jsonb_typeof(");
  expect(state.queries[3].sql).toContain("left(");
  expect(state.queries[3].sql).toContain("::integer");
  expect(state.queries.some((query) => query.sql.includes("for share"))).toBe(false);
});
it.each([
  ["submission", ["report.created"]],
  ["review", ["report.review"]],
  ["decision", ["report.resolve", "report.dismiss", "report.remove_comment"]],
] as const)("filters %s actions before the seven-day snapshot", async (group, actions) => {
  state.rows = [[report], [[stamp]], []];
  await reports.history(own, "report", { ...base, period: "7", group });
  const query = state.queries[2];
  for (const action of actions) expect(query.params).toContain(action);
  expect(query.params).toContain(7);
  expect(query.sql).toContain("interval '1 day'");
});
it("returns twenty tied events and a context-bound precise cursor", async () => {
  state.rows = [[report], [[stamp]], Array.from({ length: 21 }, (_, i) => event(`event-${i}`))];
  const result = await reports.history(own, "report", base);
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ ...cursor, id: "event-19" });
  expect(result.hasMore).toBe(true);
});
it("resolves a cursor within the same report, allowed actions and retained cutoff", async () => {
  state.rows = [[report], [["2026-10-12T00:01:00.000000Z"]], [["anchor", stamp]], []];
  expect((await reports.history(own, "report", { ...base, cursor })).until).toBe(stamp);
  expect(state.queries[2].params).toEqual(expect.arrayContaining(["report", stamp, "anchor", 1]));
  expect(state.queries[3].params).toEqual(expect.arrayContaining([stamp, "anchor", 21]));
  expect(state.queries[3].sql).toContain(") < (");
});
it.each([
  { cursor: { ...cursor, context: context("other") } },
  { cursor, group: "decision" as const },
  { query: "private query" },
  { before: "legacy-id" },
])("rejects a reused scope or unsupported filters before storage %j", async (change) => {
  await expect(reports.history(own, "report", { ...base, ...change })).rejects.toMatchObject({
    statusCode: 400,
  });
  expect(state.queries).toHaveLength(0);
});
it("rejects requester/staff cursor reuse and removed scoped anchors", async () => {
  await expect(reports.history(staff, "report", { ...base, cursor })).rejects.toMatchObject({
    code: "INVALID_CURSOR",
  });
  state.rows = [[report], [[stamp]], []];
  await expect(reports.history(own, "report", { ...base, cursor })).rejects.toMatchObject({
    code: "REPORT_HISTORY_EXPIRED",
  });
});
it("adds literal text/ID search after requester scope and preserves oldest-first staff ordering", async () => {
  state.rows = [[]];
  await reports.page(own, { page: 2, view: "pending", query: "100%_\\" });
  expect(state.queries[0].params).toEqual(
    expect.arrayContaining(["owner", "%100\\%\\_\\\\%", 21, 20]),
  );
  expect(state.queries[0].sql).toContain(" ilike ");
  expect(state.queries[0].sql).toContain('"created_at" desc');
  state.rows = [[["moderator"]], []];
  await reports.page(staff, { page: 1, view: "pending", query: "report" });
  expect(state.queries.at(-1)?.sql).toContain('"created_at" asc');
});
it.each(["x".repeat(81), " padded "])(
  "rejects invalid repository search before storage %s",
  async (query) => {
    await expect(reports.page(own, { page: 1, view: "pending", query })).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(state.queries).toHaveLength(0);
  },
);
