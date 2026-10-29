import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  lock: vi.fn(),
  push: vi.fn(),
  failInbox: false,
}));
vi.mock("../packages/db/src/repositories/notification-preference-lock", () => ({
  lockNotificationPreferencesForUsers: state.lock,
}));
vi.mock("../packages/db/src/repositories/web-push-admission-recovery", () => ({
  enqueueWebPushWithRecoveryWithin: state.push,
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    if (state.failInbox && sql.startsWith("insert")) throw new Error("Inbox failed");
    return { rows: state.rows.shift() ?? [] };
  });
  const proxy = new Proxy(database, {
    get(target, key) {
      if (key === "transaction")
        return (work: (tx: typeof database) => unknown) => {
          return work(proxy);
        };
      const value = Reflect.get(target, key);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  return { db: proxy };
});

import { formatNotification } from "../apps/web/src/lib/notification-copy";
import { db } from "../packages/db/src/client";
import { discussionModerationNotice } from "../packages/db/src/repositories/discussion-moderation-notice";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const item = { auditId: "audit", authorId: "author", commentId: "comment", slug: "guide" },
  insert = () => state.queries.find((q) => q.sql.startsWith("insert"));
beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [[], [["notice"]]];
  state.failInbox = false;
  state.push.mockResolvedValue({ queued: 1, reason: "queued" });
});
it("locks content preferences and stores a status-only notice with a safe target link", async () => {
  await discussionModerationNotice(db as unknown as Tx, item);
  expect(state.lock).toHaveBeenCalledWith(db, ["author"]);
  expect(insert()?.params).toEqual(
    expect.arrayContaining([
      "author",
      "Discussion moderation",
      "Comment comment: removed.",
      "/articles/guide#discussion",
    ]),
  );
  expect(insert()?.sql).toContain("on conflict do nothing");
  expect(state.push).toHaveBeenCalledWith(db, insert()?.params[0], "author");
});
it("respects explicitly disabled content preferences", async () => {
  state.rows = [[[false]]];
  await discussionModerationNotice(db as unknown as Tx, item);
  expect(insert()).toBeUndefined();
  expect(state.push).not.toHaveBeenCalled();
});
it("uses stable audit/recipient identities and skips push if already notified", async () => {
  await discussionModerationNotice(db as unknown as Tx, item);
  const id = insert()?.params[0];
  state.queries = [];
  state.rows = [[], []];
  state.push.mockClear();
  await discussionModerationNotice(db as unknown as Tx, item);
  expect(insert()?.params[0]).toBe(id);
  expect(state.push).not.toHaveBeenCalled();
});
it("propagates inbox and intent failures while preserving inbox on optional push degradation", async () => {
  state.failInbox = true;
  await expect(discussionModerationNotice(db as unknown as Tx, item)).rejects.toMatchObject({
    cause: { message: "Inbox failed" },
  });
  state.failInbox = false;
  state.rows = [[], [["notice"]]];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  await expect(discussionModerationNotice(db as unknown as Tx, item)).resolves.toBeUndefined();
  expect(state.push).toHaveBeenCalledWith(db, insert()?.params[0], "author");
  state.rows = [[], [["notice"]]];
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(discussionModerationNotice(db as unknown as Tx, item)).rejects.toThrow(
    "Admission intent failed",
  );
});
it.each(["en", "ru"] as const)(
  "localizes the bounded persisted moderation template in %s",
  (locale) => {
    const result = formatNotification(
      { title: "Discussion moderation", message: "Comment comment: removed.", data: undefined },
      { approved: "", rejected: "", version: "", notes: "" },
      locale,
    );
    expect(result.message).toBe(
      locale === "ru"
        ? "Модератор удалил ваш комментарий. Ответы сохранены."
        : "A moderator removed your comment. Replies remain.",
    );
    expect(result.message).not.toContain("comment:");
  },
);

it("links unavailable publications to the author's private discussion workspace", async () => {
  await discussionModerationNotice(db as unknown as Tx, { ...item, available: false });
  expect(insert()?.params).toContain("/workspace/discussions");
  expect(insert()?.params).not.toContain("/articles/guide#discussion");
});
