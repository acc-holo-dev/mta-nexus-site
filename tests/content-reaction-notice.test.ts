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
import { db } from "../packages/db/src/client";
import { contentReactionNotice } from "../packages/db/src/repositories/content-reaction-notice";
import { formatNotification } from "../apps/web/src/lib/notification-copy";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const item = { id: "content", slug: "guide", authorId: "author" },
  insert = () => state.queries.find((q) => q.sql.startsWith("insert"));
beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [[], [["notice"]]];
  state.failInbox = false;
  state.push.mockResolvedValue({ queued: 1, reason: "queued" });
});
it("locks content preferences and stores a status-only notice with a safe target link", async () => {
  await contentReactionNotice(db as unknown as Tx, item, "actor");
  expect(state.lock).toHaveBeenCalledWith(db, ["author"]);
  expect(insert()?.params).toEqual(
    expect.arrayContaining([
      "author",
      "Publication reaction",
      "Publication content: reaction.",
      "/articles/guide",
    ]),
  );
  expect(insert()?.sql).toContain("on conflict do nothing");
  expect(state.push).toHaveBeenCalledWith(db, insert()?.params[0], "author");
});
it("omits self notices and respects explicitly disabled content preferences", async () => {
  await contentReactionNotice(db as unknown as Tx, item, "author");
  expect(state.queries).toHaveLength(0);
  state.rows = [[[false]]];
  await contentReactionNotice(db as unknown as Tx, item, "actor");
  expect(insert()).toBeUndefined();
  expect(state.push).not.toHaveBeenCalled();
});
it("uses stable actor/publication identities and skips push if already notified", async () => {
  await contentReactionNotice(db as unknown as Tx, item, "actor");
  const id = insert()?.params[0];
  state.queries = [];
  state.rows = [[], []];
  state.push.mockClear();
  await contentReactionNotice(db as unknown as Tx, item, "actor");
  expect(insert()?.params[0]).toBe(id);
  expect(state.push).not.toHaveBeenCalled();
});
it("propagates inbox and intent failures while preserving inbox on optional push degradation", async () => {
  state.failInbox = true;
  await expect(contentReactionNotice(db as unknown as Tx, item, "actor")).rejects.toMatchObject({
    cause: { message: "Inbox failed" },
  });
  state.failInbox = false;
  state.rows = [[], [["notice"]]];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  await expect(contentReactionNotice(db as unknown as Tx, item, "actor")).resolves.toBeUndefined();
  expect(state.push).toHaveBeenCalledWith(db, insert()?.params[0], "author");
  state.rows = [[], [["notice"]]];
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(contentReactionNotice(db as unknown as Tx, item, "actor")).rejects.toThrow(
    "Admission intent failed",
  );
});
it.each(["en", "ru"] as const)(
  "localizes the bounded persisted reaction template in %s",
  (locale) => {
    const result = formatNotification(
      { title: "Publication reaction", message: "Publication content: reaction.", data: undefined },
      { approved: "", rejected: "", version: "", notes: "" },
      locale,
    );
    expect(result.message).toBe(
      locale === "ru"
        ? "Читатель оставил реакцию на вашу публикацию."
        : "A reader reacted to your publication.",
    );
    expect(result.message).not.toContain("content");
  },
);
