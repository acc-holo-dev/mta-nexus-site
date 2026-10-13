import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  url: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("@nexus/db", async () => ({
  db: { execute: mocks.execute, select: mocks.select, transaction: mocks.transaction },
  comments: (await import("../packages/db/src/schema")).comments,
  readDatabaseUrl: mocks.url,
}));

import {
  assertDiscussionReplayClosedWindow as closedWindow,
  previewDiscussionReplay,
  readDiscussionReplayPage,
  resolveDiscussionReplayDatabaseIdentity as resolve,
} from "../apps/web/scripts/discussion-replay-database";
import { discussionReplayDatabaseIdentity } from "../apps/web/scripts/discussion-replay-options";

const scope = { databaseName: "nexus", databaseOid: "123", commentsOid: "456", followsOid: "789" };
const url = "postgres://worker:PRIVATE_PASSWORD@db.example/nexus";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.execute.mockResolvedValue([scope]);
  mocks.url.mockReturnValue(url);
});

const from = "2026-10-12T00:00:00.000001Z",
  until = "2026-10-12T01:00:00.000002Z";
it("compares the closed boundary with database time at exact microsecond precision", async () => {
  mocks.execute.mockResolvedValue([{ serverNow: until }]);
  expect(await closedWindow(until)).toBe(until);
  const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
  expect(query.sql).toContain("pg_catalog.statement_timestamp()");
  expect(query.sql).toContain('SS.US"Z"');
  expect(query.params).toEqual([]);
  mocks.execute.mockResolvedValue([{ serverNow: "2026-10-12T01:00:00.000003Z" }]);
  await expect(closedWindow(until)).resolves.toBe("2026-10-12T01:00:00.000003Z");
  mocks.execute.mockResolvedValue([{ serverNow: "2026-10-12T01:00:00.000001Z" }]);
  await expect(closedWindow(until)).rejects.toThrow("database time");
});
it.each(
  [[], [{}], [{ serverNow: null }], [{ serverNow: "2026-10-12T01:00:00.000Z" }]].map((rows) => ({
    rows,
  })),
)("rejects unavailable or imprecise database clocks %#", async ({ rows }) => {
  mocks.execute.mockResolvedValue(rows);
  await expect(closedWindow(until)).rejects.toThrow();
});

function selection(rows: unknown[]) {
  const query = { from: vi.fn(), where: vi.fn(), orderBy: vi.fn(), limit: vi.fn() };
  query.from.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  query.limit.mockResolvedValue(rows);
  return query;
}
it("shares inclusive source bounds, precise tuple cursor and deterministic order with a fifty-row delivery page", async () => {
  const query = selection([]);
  mocks.select.mockReturnValue(query);
  await readDiscussionReplayPage(from, until, { createdAt: from, id: "cmt_a" });
  const where = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
  expect(where.sql).toContain('"comments"."content_id" is not null');
  expect(where.sql).toContain('"comments"."product_id" is null');
  expect(where.sql).toMatch(/>= .*::timestamptz.*<= .*::timestamptz/);
  expect(where.sql).toMatch(/\("comments"\."created_at","comments"\."id"\) > /);
  expect(where.params).toEqual([from, until, from, "cmt_a"]);
  expect(query.limit).toHaveBeenCalledWith(50);
  expect(query.orderBy.mock.calls[0].map((field) => new PgDialect().sqlToQuery(field).sql)).toEqual(
    ['"comments"."created_at" asc', '"comments"."id" asc'],
  );
  expect(Object.keys(mocks.select.mock.calls[0][0])).toEqual(["id", "contentId", "createdAt"]);
});
it.each([0, -1, 1.5, 10002, NaN])("rejects an unbounded page size %s before querying", (limit) => {
  expect(() => readDiscussionReplayPage(from, until, null, limit)).toThrow();
  expect(mocks.select).not.toHaveBeenCalled();
});

function previewDatabase(rows: unknown[], serverNow = until, repairPush = false) {
  const repair = {
    notificationsOid: "100",
    preferencesOid: "101",
    subscriptionsOid: "102",
    outboxOid: "103",
    gateOid: "104",
    sessionsOid: "105",
  };
  const execute = vi
    .fn()
    .mockResolvedValueOnce([{ ...scope, ...(repairPush ? repair : {}) }])
    .mockResolvedValueOnce([{ serverNow }]);
  const query = selection(rows);
  const select = vi.fn().mockReturnValue(query);
  mocks.transaction.mockImplementation((callback) => callback({ execute, select }));
  return { execute, select, query };
}
it.each([0, 1, 2, 3])(
  "previews %s source rows in a bounded read-only snapshot without identities",
  async (count) => {
    const rows = Array.from({ length: count }, (_, index) => ({
      id: `PRIVATE_COMMENT_${index}`,
      contentId: "PRIVATE_CONTENT",
      createdAt: from,
      text: "PRIVATE_TEXT",
      recipientId: "PRIVATE_RECIPIENT",
    }));
    const { query, execute } = previewDatabase(rows);
    const result = await previewDiscussionReplay({ from, until, limit: 2, repairPush: false });
    expect(result).toEqual({
      dryRun: true,
      deliveryPolicy: "inbox",
      from,
      until,
      serverNow: until,
      limit: 2,
      matchingComments: Math.min(count, 2),
      hasMore: count > 2,
      checkpoint: "ignored",
    });
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|PASSWORD|db\.example|nexus|Oid/);
    expect(mocks.transaction.mock.calls[0][1]).toEqual({
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
    expect(query.limit).toHaveBeenCalledWith(3);
    const where = new PgDialect().sqlToQuery(query.where.mock.calls[0][0]);
    expect(where.params).toEqual([from, until]);
    expect(execute).toHaveBeenCalledTimes(2);
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  },
);
it("previews repair scope and maximum budget without loading recipients, notices or outbox jobs", async () => {
  const { query, execute } = previewDatabase([], until, true);
  expect(
    await previewDiscussionReplay({ from, until, limit: 10000, repairPush: true }),
  ).toMatchObject({
    deliveryPolicy: "inbox-and-pending-push",
    hasMore: false,
  });
  expect(new PgDialect().sqlToQuery(execute.mock.calls[0][0]).sql).toContain(
    "to_regclass('web_push_outbox')",
  );
  expect(query.limit).toHaveBeenCalledWith(10001);
});
it("refuses an open window before reading any source rows", async () => {
  const { select } = previewDatabase([], "2026-10-12T01:00:00.000001Z");
  await expect(
    previewDiscussionReplay({ from, until, limit: 10, repairPush: false }),
  ).rejects.toThrow("database time");
  expect(select).not.toHaveBeenCalled();
});
it.each([0, 10001, NaN, 0.5])(
  "rejects invalid preview budget %s before opening a transaction",
  async (limit) => {
    await expect(
      previewDiscussionReplay({ from, until, limit, repairPush: false }),
    ).rejects.toThrow("budget");
    expect(mocks.transaction).not.toHaveBeenCalled();
  },
);
it("reads actual database and resolved relations in one metadata-only query and returns only a hash", async () => {
  expect(await resolve()).toBe(discussionReplayDatabaseIdentity(url, scope));
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
  expect(query.sql).toContain("pg_catalog.current_database()");
  expect(query.sql).toContain("from pg_catalog.pg_database");
  expect(query.sql).toContain("pg_catalog.to_regclass('comments')::oid::text");
  expect(query.sql).toContain("pg_catalog.to_regclass('follows')::oid::text");
  expect(query.params).toEqual([]);
  expect(query.sql).not.toMatch(
    /insert|delete|update|password|comment\.text|email|pg_control_system/i,
  );
});
it.each(
  [[], [{ ...scope, commentsOid: null }], [{ ...scope, followsOid: null }]].map((rows) => ({
    rows,
  })),
)("refuses unavailable database/table scope before checkpoint adoption %#", async ({ rows }) => {
  mocks.execute.mockResolvedValue(rows);
  await expect(resolve()).rejects.toThrow("scope");
});
it("propagates unavailable database rather than creating an unbound fallback identity", async () => {
  mocks.execute.mockRejectedValue(Error("DB unavailable"));
  await expect(resolve()).rejects.toThrow("DB unavailable");
  expect(mocks.url).not.toHaveBeenCalled();
});

it("binds every repair-specific relation and refuses missing outbox scope", async () => {
  mocks.execute.mockResolvedValue([
    {
      ...scope,
      notificationsOid: "100",
      preferencesOid: "101",
      subscriptionsOid: "102",
      outboxOid: "103",
      gateOid: "104",
      sessionsOid: "105",
    },
  ]);
  expect(await resolve(true)).not.toBe(discussionReplayDatabaseIdentity(url, scope));
  const query = new PgDialect().sqlToQuery(mocks.execute.mock.calls[0][0]);
  for (const name of [
    "notifications",
    "notification_preferences",
    "web_push_subscriptions",
    "web_push_outbox",
    "web_push_queue_gate",
    "sessions",
  ])
    expect(query.sql).toContain(`pg_catalog.to_regclass('${name}')`);
  mocks.execute.mockResolvedValue([{ ...scope }]);
  await expect(resolve(true)).rejects.toThrow("scope");
});
