import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import { notifications } from "../packages/db/src/schema";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  transactions: 0,
}));
const mocks = vi.hoisted(() => ({ source: vi.fn(), push: vi.fn() }));
vi.mock("../packages/db/src/repositories/follow-workspace", () => ({
  followWorkspaceRepository: { discussionNoticeWithin: mocks.source },
}));
vi.mock("../packages/db/src/repositories/web-push-outbox", () => ({
  enqueueWebPushOutboxForNotification: mocks.push,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: sql.includes("pg_advisory_xact_lock") ? [] : (state.rows.shift() ?? []) };
  });
  const proxy: typeof database = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (fn: (tx: typeof proxy) => unknown) => {
          state.transactions++;
          return fn(proxy);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});

import { NotificationRepository } from "../packages/db/src/repositories/notifications";

const repository = new NotificationRepository();
const input = { recipientId: "reader", contentId: "article", commentId: "reply" };
const data = {
  id: "ntf_reply_stable",
  recipientId: "reader",
  title: "New discussion reply",
  message: "A publication you follow has a new reply.",
  type: "content",
  category: "follow",
  link: "/articles/current?comment=reply#comment-reply",
  isRead: false,
  createdAt: "2026-10-12T00:00:00.000Z",
  data: null,
};
const row = (overrides: Record<string, unknown> = {}) =>
  Object.keys(getTableColumns(notifications)).map(
    (key) => ({ ...data, ...overrides })[key as keyof typeof data],
  );
beforeEach(() => {
  vi.resetAllMocks();
  state.queries = [];
  state.rows = [];
  state.transactions = 0;
  mocks.source.mockResolvedValue({ following: true, direct: false, id: data.id, link: data.link });
  mocks.push.mockResolvedValue({ queued: 2, reason: "queued" });
});
it("serializes preferences after rechecking live source rights and stores a generic notice in the existing outbox", async () => {
  state.rows = [[], [row()], [[data.id]]];
  expect(await repository.createDiscussionReplyWithPush(input)).toEqual({
    state: "stored",
    pushJobs: 2,
    pushQueueState: "queued",
  });
  expect(mocks.source).toHaveBeenCalledWith(expect.anything(), "reader", "article", "reply");
  expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
  expect(state.queries[1].sql).toContain('"notification_preferences"."user_id" =');
  expect(state.queries[1].params).toEqual(["reader", 1]);
  const insert = state.queries[2];
  expect(insert.sql).toContain("on conflict do nothing");
  expect(insert.params).toEqual(
    expect.arrayContaining([
      data.id,
      "reader",
      "New discussion reply",
      data.message,
      data.link,
      "follow",
    ]),
  );
  expect(insert.params.join(" ")).not.toMatch(/private-title|comment-text|author-name/u);
  expect(mocks.push).toHaveBeenCalledWith(expect.anything(), data.id, "reader");
  expect(state.transactions).toBe(2);
});
it.each([
  [true, true, true, true, "follow"],
  [true, true, false, true, "content"],
  [false, true, true, true, "content"],
  [true, false, false, true, null],
  [false, true, true, false, null],
  [true, true, false, false, null],
  [true, false, true, false, "follow"],
] as const)(
  "uses explicit follow %s and direct participation %s under their separate preferences",
  async (following, direct, followEnabled, contentEnabled, category) => {
    mocks.source.mockResolvedValue({ following, direct, id: data.id, link: data.link });
    state.rows = [[[followEnabled, contentEnabled]], [row()], [[data.id]]];
    const result = await repository.createDiscussionReplyWithPush(input);
    expect(result.state).toBe(category ? "stored" : "suppressed");
    if (category)
      expect(state.queries.find((query) => query.sql.startsWith("insert"))?.params).toContain(
        category,
      );
    else {
      expect(state.queries).toHaveLength(2);
      expect(mocks.push).not.toHaveBeenCalled();
    }
  },
);
it("skips removed or inaccessible sources before reading preferences or writing inbox rows", async () => {
  mocks.source.mockResolvedValue(null);
  expect(await repository.createDiscussionReplyWithPush(input)).toMatchObject({
    state: "skipped",
    pushJobs: 0,
  });
  expect(state.queries).toHaveLength(0);
  expect(mocks.push).not.toHaveBeenCalled();
});
it("leaves existing read state intact and never enqueues a second push for the same reply and reader", async () => {
  state.rows = [[], []];
  expect(await repository.createDiscussionReplyWithPush(input)).toMatchObject({
    state: "duplicate",
    pushJobs: 0,
  });
  expect(state.queries.at(-1)?.sql).toContain("on conflict do nothing");
  expect(state.queries.some((q) => q.sql.startsWith("update"))).toBe(false);
  expect(mocks.push).not.toHaveBeenCalled();
  expect(state.transactions).toBe(1);
});
it("keeps the authoritative inbox row when the optional push savepoint fails", async () => {
  state.rows = [[], [row()]];
  mocks.push.mockRejectedValue(Error("private-queue"));
  expect(await repository.createDiscussionReplyWithPush(input)).toEqual({
    state: "stored",
    pushJobs: 0,
    pushQueueState: "error",
  });
  expect(state.transactions).toBe(2);
});
it("reports queue capacity without converting the saved notification into a failure", async () => {
  state.rows = [[], [row()]];
  mocks.push.mockResolvedValue({ queued: 0, reason: "saturated" });
  expect(await repository.createDiscussionReplyWithPush(input)).toEqual({
    state: "stored",
    pushJobs: 0,
    pushQueueState: "saturated",
  });
});
it("preserves ordinary notification insertion semantics used by other modules", async () => {
  state.rows = [[], []];
  await expect(
    repository.createWithPushOutbox({
      id: "ordinary",
      recipientId: "reader",
      title: "Order",
      message: "Order",
      type: "order",
      category: "commerce",
    }),
  ).rejects.toThrow("Notification insert did not return a row");
  expect(state.queries.at(-1)?.sql).not.toContain("on conflict");
  expect(mocks.source).not.toHaveBeenCalled();
  expect(mocks.push).not.toHaveBeenCalled();
});

const receipt = (state: string) => ({
  kind: "discussion_push",
  discussionPush: { version: 1, state },
});
it("stores pending proof with database time and commits admission proof alongside jobs", async () => {
  state.rows = [[], [row()], [[data.id]]];
  await repository.createDiscussionReplyWithPush(input);
  const insert = state.queries.find((query) => query.sql.startsWith("insert"));
  expect(insert?.sql).toContain("clock_timestamp()");
  expect(insert?.params).toContain(JSON.stringify(receipt("pending")));
  const update = state.queries.find((query) => query.sql.startsWith("update"));
  expect(update?.params).toContain(JSON.stringify(receipt("queued")));
  expect(update?.sql).not.toContain('"is_read" =');
});
it("repairs only a proven pending unread reply under source, preference and notice locks", async () => {
  state.rows = [[], [], [row({ data: receipt("pending") })], [[data.id]]];
  expect(await repository.createDiscussionReplyWithPush({ ...input, repairPush: true })).toEqual({
    state: "duplicate",
    pushJobs: 2,
    pushQueueState: "queued",
  });
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith(expect.anything(), data.id, "reader", true);
  const lookup = state.queries.find((query) => query.sql.includes('from "notifications"'));
  expect(lookup?.sql).toContain("for update");
  expect(lookup?.sql).toContain("interval '24 hours' > clock_timestamp()");
  expect(lookup?.params).toEqual([data.id, "reader", "content"]);
  expect(state.queries.filter((query) => query.sql.startsWith("update"))).toHaveLength(1);
});
it.each([
  null,
  receipt("queued"),
  receipt("unavailable"),
  receipt("unknown"),
  { ...receipt("pending"), extra: "unproven" },
])(
  "never guesses repair eligibility from a missing, settled or damaged admission receipt %#",
  async (proof) => {
    state.rows = [[], [], [row({ data: proof })]];
    expect(
      await repository.createDiscussionReplyWithPush({ ...input, repairPush: true }),
    ).toMatchObject({ state: "duplicate", pushJobs: 0 });
    expect(mocks.push).not.toHaveBeenCalled();
    expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
  },
);
it("never reopens a read notice or switches its original preference category", async () => {
  for (const original of [
    row({ data: receipt("pending"), isRead: true }),
    row({ data: receipt("pending"), category: "content" }),
  ]) {
    state.rows = [[], [], [original]];
    await repository.createDiscussionReplyWithPush({ ...input, repairPush: true });
  }
  expect(mocks.push).not.toHaveBeenCalled();
});
it.each(["saturated", "error", "proof-error"])(
  "retains pending evidence when repair encounters %s",
  async (failure) => {
    state.rows = [[], [], [row({ data: receipt("pending") })]];
    if (failure === "error") mocks.push.mockRejectedValue(Error("queue detail"));
    else if (failure === "saturated")
      mocks.push.mockResolvedValue({ queued: 0, reason: "saturated" });
    // With proof-error the UPDATE returns no row, causing the jobs/proof savepoint to fail.
    const result = await repository.createDiscussionReplyWithPush({ ...input, repairPush: true });
    expect(result).toMatchObject({
      state: "duplicate",
      pushJobs: 0,
      pushQueueState: failure === "saturated" ? "saturated" : "error",
    });
    expect(state.transactions).toBe(2);
    expect(state.queries.filter((query) => query.sql.startsWith("update"))).toHaveLength(
      failure === "proof-error" ? 1 : 0,
    );
  },
);
it("settles unavailable devices without renewing a pending notice's consent", async () => {
  state.rows = [[], [], [row({ data: receipt("pending") })], [[data.id]]];
  mocks.push.mockResolvedValue({ queued: 0, reason: "no_subscriptions" });
  expect(
    await repository.createDiscussionReplyWithPush({ ...input, repairPush: true }),
  ).toMatchObject({ state: "duplicate", pushQueueState: "no_subscriptions" });
  expect(state.queries.at(-1)?.params).toContain(JSON.stringify(receipt("unavailable")));
});
