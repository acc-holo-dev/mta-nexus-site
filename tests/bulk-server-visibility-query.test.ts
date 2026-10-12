import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  auditFailure: false,
  transactions: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.auditFailure && sql.startsWith('insert into "audit_events"'))
      throw Error("mandatory audit failed");
    return {
      rows:
        sql.startsWith("select") || sql.includes(" returning ") ? (state.rows.shift() ?? []) : [],
    };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return (callback: (tx: typeof database) => unknown, options: unknown) => {
            state.transactions.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import { ServerRepository } from "../packages/db/src/repositories/servers";

const repo = new ServerRepository(),
  time = "2026-10-12T00:00:00.123456Z",
  next = "2026-10-12T00:00:00.124456Z";
const input = { serverIds: ["c", "b", "a"], visibility: "private" as const };
const records = () => [
  ["a", "Personal", "actor", null, "maintenance", "public", time],
  ["b", "Team B", null, "org", "active", "public", time],
  ["c", "Team C", null, "org", "suspended", "unlisted", time],
];
function prepare(rows = records()) {
  state.rows = [
    rows,
    [["user"]],
    [["org", "owner"]],
    [["org", "developer", ["manage_products", "manage_servers"]]],
  ];
}
const writes = () => state.queries.filter((row) => /^(insert|update|delete)/u.test(row.sql));
beforeEach(() => {
  state.queries = [];
  state.rows = [];
  state.auditFailure = false;
  state.transactions = [];
  prepare();
});
it("previews only current scoped listings and reads each live authority table once under ordered locks", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  expect(preview.items.map((row) => row.id)).toEqual(["a", "b", "c"]);
  expect(preview.items[2]).toMatchObject({
    status: "suspended",
    organization: true,
    before: "unlisted",
    after: "private",
    changed: true,
    revision: time,
  });
  expect(preview).not.toHaveProperty("grants");
  expect(preview.items[0]).not.toHaveProperty("ownerId");
  expect(state.queries).toHaveLength(4);
  const listings = state.queries[0];
  expect(listings.sql).toContain('order by "servers"."id" asc for share');
  expect(listings.sql).toContain('"servers"."organization_id" is null');
  expect(listings.sql).toContain('"users"."role" =');
  expect(listings.params).toContain('["manage_servers"]');
  expect(state.queries[1].sql).toContain('from "users"');
  expect(state.queries[2].params).toEqual(["org"]);
  expect(state.queries[3].params).toEqual(["org", "actor"]);
  expect(writes()).toHaveLength(0);
});
it("applies one bounded update and one mandatory audit insert, without changing endpoints, status or telemetry", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  state.queries = [];
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["b", "private", next],
    ["c", "private", next],
  ]);
  const saved = await repo.applyVisibilityBatch(
    "actor",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b", "audit-c"],
  );
  expect(saved.items.every((row) => row.visibility === "private" && row.revision === next)).toBe(
    true,
  );
  expect(writes()).toHaveLength(2);
  expect(state.queries[0].sql).toContain('order by "servers"."id" asc for update');
  const update = writes()[0];
  expect(update.sql).toContain("greatest(clock_timestamp()");
  expect(update.params).toEqual(["private", "a", "b", "c"]);
  const set = update.sql.split(" set ")[1].split(" where ")[0];
  for (const field of [
    "owner_id",
    "organization_id",
    "ip_address",
    "port",
    "is_verified",
    "endpoint_revision",
    "current_players",
    "last_observed_at",
    "status",
  ])
    expect(set).not.toContain(`"${field}"`);
  const audits = writes()[1];
  expect(audits.params).toContain("server.updated");
  expect(audits.params).toContain(
    JSON.stringify({
      fields: ["visibility"],
      previousVisibility: "public",
      visibility: "private",
      previewRevision: preview.previewRevision,
      batchSize: 3,
    }),
  );
});
it("keeps already-matching rows and their revisions intact and records only actual changes", async () => {
  const rows = records().map((row) => [...row]);
  rows[0][5] = "private";
  rows[2][5] = "private";
  prepare(rows);
  const preview = await repo.previewVisibilityBatch("actor", input);
  expect(preview.items.map((row) => row.changed)).toEqual([false, true, false]);
  state.queries = [];
  prepare(rows);
  state.rows.push([["b", "private", next]]);
  const saved = await repo.applyVisibilityBatch(
    "actor",
    { ...input, previewRevision: preview.previewRevision },
    ["audit-a", "audit-b", "audit-c"],
  );
  expect(saved.items).toEqual([
    { id: "a", visibility: "private", changed: false, revision: time },
    { id: "b", visibility: "private", changed: true, revision: next },
    { id: "c", visibility: "private", changed: false, revision: time },
  ]);
  expect(writes()[0].params).toEqual(["private", "b"]);
  expect(writes()[1].params).toContain("audit-b");
  expect(writes()[1].params).not.toContain("audit-a");
});
it("handles an all-matching review without a timestamp or audit write", async () => {
  const rows = records().map((row) => {
    const copy = [...row];
    copy[5] = "private";
    return copy;
  });
  prepare(rows);
  const preview = await repo.previewVisibilityBatch("actor", input);
  state.queries = [];
  prepare(rows);
  expect(
    (
      await repo.applyVisibilityBatch(
        "actor",
        { ...input, previewRevision: preview.previewRevision },
        ["a1", "a2", "a3"],
      )
    ).items.every((row) => !row.changed && row.revision === time),
  ).toBe(true);
  expect(writes()).toHaveLength(0);
});
it.each(["name", "revision", "visibility", "ownership", "grant", "actor", "target"])(
  "refuses an outdated or retargeted review (%s) before any write",
  async (kind) => {
    const preview = await repo.previewVisibilityBatch("actor", input);
    state.queries = [];
    const rows = records();
    if (kind === "name") rows[1][1] = "Changed";
    if (kind === "revision") rows[1][6] = next;
    if (kind === "visibility") rows[1][5] = "unlisted";
    if (kind === "ownership") rows[0][2] = "new-owner";
    prepare(rows);
    if (kind === "grant") state.rows[3] = [["org", "admin", []]];
    await expect(
      repo.applyVisibilityBatch(
        kind === "actor" ? "other" : "actor",
        {
          ...input,
          visibility: kind === "target" ? "public" : "private",
          previewRevision: preview.previewRevision,
        },
        ["a1", "a2", "a3"],
      ),
    ).rejects.toMatchObject({
      code: ["ownership", "actor"].includes(kind) ? "FORBIDDEN" : "SERVER_BATCH_CHANGED",
    });
    expect(writes()).toHaveLength(0);
  },
);
it.each(["missing", "revoked", "orphan", "account"])(
  "refuses incomplete live authority (%s) without changing any listing",
  async (kind) => {
    prepare();
    if (kind === "missing") state.rows[0] = [];
    if (kind === "revoked") state.rows[3] = [["org", "developer", []]];
    if (kind === "orphan") state.rows[2] = [];
    if (kind === "account") state.rows[1] = [];
    await expect(repo.previewVisibilityBatch("actor", input)).rejects.toMatchObject({
      code: kind === "missing" ? "NOT_FOUND" : "FORBIDDEN",
    });
    expect(writes()).toHaveLength(0);
  },
);
it("honors only the currently locked platform administrator and does not reread delegated grants", async () => {
  state.rows = [records(), [["admin"]]];
  await repo.previewVisibilityBatch("platform-admin", input);
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].sql).toContain("for share");
});
it("fails if the complete audit cannot be recorded or acknowledgements do not match stored rows", async () => {
  const preview = await repo.previewVisibilityBatch("actor", input);
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["b", "private", next],
    ["c", "private", next],
  ]);
  state.auditFailure = true;
  await expect(
    repo.applyVisibilityBatch("actor", { ...input, previewRevision: preview.previewRevision }, [
      "a1",
      "a2",
      "a3",
    ]),
  ).rejects.toThrow();
  state.auditFailure = false;
  state.queries = [];
  prepare();
  state.rows.push([
    ["a", "private", next],
    ["a", "private", next],
    ["c", "private", next],
  ]);
  await expect(
    repo.applyVisibilityBatch("actor", { ...input, previewRevision: preview.previewRevision }, [
      "a1",
      "a2",
      "a3",
    ]),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_CHANGED" });
  expect(writes()).toHaveLength(1);
});
it.each([
  { serverIds: [] },
  { serverIds: ["a", "a"] },
  { serverIds: ["../foreign"] },
  { serverIds: Array.from({ length: 21 }, (_, i) => `s${i}`) },
])("bounds selection before acquiring locks (%j)", async (selection) => {
  await expect(
    repo.previewVisibilityBatch("actor", { ...input, ...selection }),
  ).rejects.toMatchObject({ code: "SERVER_BATCH_INVALID" });
  expect(state.queries).toHaveLength(0);
});
