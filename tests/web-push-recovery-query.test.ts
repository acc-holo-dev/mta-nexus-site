import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { webPushQueueGate } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.rows.shift() ?? [] };
  });
  return { db: database };
});

import { db } from "../packages/db/src/client";
import { enqueueWebPushOutboxForNotification as enqueue } from "../packages/db/src/repositories/web-push-outbox";

const gate = (capacity: number) =>
  Object.keys(getTableColumns(webPushQueueGate)).map(
    (key) => ({ singleton: true, capacity })[key as "singleton" | "capacity"],
  );
beforeEach(() => {
  state.queries = [];
  state.rows = [];
});
it("bounds recovery to old active devices and the original notification's deadline", async () => {
  state.rows = [[["sub"]], [gate(10)], [[0]], [["job"]]];
  expect(await enqueue(db as never, "notice", "reader", true)).toEqual({
    queued: 1,
    reason: "queued",
  });
  const subscriptions = state.queries[0];
  expect(subscriptions.sql).toContain('"web_push_subscriptions"."created_at" <=');
  expect(subscriptions.sql).toContain("n.created_at");
  expect(subscriptions.sql).toContain("n.recipient_id =");
  expect(subscriptions.sql).toContain("interval '1 hour' > clock_timestamp()");
  expect(subscriptions.params).toEqual(expect.arrayContaining(["notice", "reader", 24, 64]));
  expect(state.queries[1].sql).toContain("for update");
  const insert = state.queries[3];
  expect(insert.sql).toContain("on conflict");
  expect(insert.sql).toContain("n.created_at");
  expect(insert.sql).not.toContain("clock_timestamp() +");
});
it("keeps ordinary queue admission independent of historical notification cutoffs", async () => {
  state.rows = [[["sub"]], [gate(10)], [[0]], [["job"]]];
  await enqueue(db as never, "notice", "reader");
  expect(state.queries[0].sql).not.toContain("n.created_at");
  expect(state.queries[3].sql).toContain("clock_timestamp() +");
});
it("does not touch capacity when no current pre-notification device remains", async () => {
  expect(await enqueue(db as never, "notice", "reader", true)).toEqual({
    queued: 0,
    reason: "no_subscriptions",
  });
  expect(state.queries).toHaveLength(1);
});
it("retains saturation without partial enqueue when the full eligible cohort exceeds capacity", async () => {
  state.rows = [[["one"], ["two"]], [gate(1)], [[0]]];
  expect(await enqueue(db as never, "notice", "reader", true)).toEqual({
    queued: 0,
    reason: "saturated",
  });
  expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
});
