import { PgDialect } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), url: vi.fn() }));
vi.mock("@nexus/db", () => ({ db: { execute: mocks.execute }, readDatabaseUrl: mocks.url }));

import { resolveDiscussionReplayDatabaseIdentity as resolve } from "../apps/web/scripts/discussion-replay-database";
import { discussionReplayDatabaseIdentity } from "../apps/web/scripts/discussion-replay-options";

const scope = { databaseName: "nexus", databaseOid: "123", commentsOid: "456", followsOid: "789" };
const url = "postgres://worker:PRIVATE_PASSWORD@db.example/nexus";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.execute.mockResolvedValue([scope]);
  mocks.url.mockReturnValue(url);
});
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
