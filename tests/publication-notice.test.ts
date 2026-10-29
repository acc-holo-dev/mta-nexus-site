import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  rows: [] as unknown[][][],
  failInbox: false,
  lock: vi.fn(),
  push: vi.fn(),
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
    if (state.failInbox && sql.startsWith('insert into "notifications"'))
      throw new Error("Inbox failed");
    return { rows: sql.startsWith("select") ? (state.rows.shift() ?? []) : [] };
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
import { publicationNotice } from "../packages/db/src/repositories/publication-notice";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const item = { id: "item", authorId: "author", organizationId: "org", serverId: undefined };
const inserts = () => state.queries.filter((q) => q.sql.startsWith('insert into "notifications"'));
beforeEach(() => {
  vi.clearAllMocks();
  state.queries = [];
  state.rows = [];
  state.failInbox = false;
  state.push.mockResolvedValue({ queued: 1, reason: "queued" });
});
it("deduplicates original author and actual owner, excludes the actor, locks preferences and stores no draft text", async () => {
  state.rows = [[["owner"]], []];
  await publicationNotice(db as unknown as Tx, item, "editor", "edited", "audit");
  expect(state.lock).toHaveBeenCalledWith(db, ["author", "owner"]);
  expect(inserts()).toHaveLength(2);
  expect(state.push).toHaveBeenCalledTimes(2);
  expect(inserts()[0].params).toContain("/workspace/content/item");
  expect(inserts()[1].params).toContain("/workspace/organizations/org/content/item");
  expect(inserts()[0].params).toContain("Publication item: edited.");
  expect(JSON.stringify(inserts())).not.toMatch(/body|staff|notes|ipAddress/u);
});
it("uses current server ownership and manager links without sending to arbitrary team members", async () => {
  state.rows = [[[null, "current-org"]], [["owner"]], []];
  await publicationNotice(
    db as unknown as Tx,
    { ...item, serverId: "srv" },
    "author",
    "created",
    "audit",
  );
  expect(inserts()).toHaveLength(1);
  expect(inserts()[0].params).toContain("/workspace/servers/srv/content/item");
  expect(state.queries[1].params).toEqual(["current-org", 1]);
});
it("honors disabled content preferences and omits self notices", async () => {
  state.rows = [[["owner"]], [["author", false]]];
  await publicationNotice(db as unknown as Tx, item, "owner", "published", "audit");
  expect(inserts()).toHaveLength(0);
  expect(state.push).not.toHaveBeenCalled();
  state.queries = [];
  await publicationNotice(
    db as unknown as Tx,
    { ...item, organizationId: undefined },
    "author",
    "edited",
    "audit",
  );
  expect(state.queries).toHaveLength(0);
});
it("uses stable audit/recipient identities and propagates inbox failure to the authoritative transaction", async () => {
  state.rows = [[["owner"]], []];
  await publicationNotice(db as unknown as Tx, item, "owner", "published", "audit");
  const id = inserts()[0].params[1];
  state.queries = [];
  state.rows = [[["owner"]], []];
  await publicationNotice(db as unknown as Tx, item, "owner", "published", "audit");
  expect(inserts()[0].params[1]).toBe(id);
  state.rows = [[["owner"]], []];
  state.failInbox = true;
  await expect(
    publicationNotice(db as unknown as Tx, item, "owner", "published", "audit"),
  ).rejects.toMatchObject({ cause: { message: "Inbox failed" } });
});
it("preserves inbox on optional push errors and propagates intent failure", async () => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  state.rows = [[["owner"]], []];
  state.push.mockResolvedValue({ queued: 0, reason: "error" });
  await expect(
    publicationNotice(db as unknown as Tx, item, "owner", "archived", "audit"),
  ).resolves.toBeUndefined();
  expect(inserts()).toHaveLength(1);
  expect(state.push).toHaveBeenCalledWith(db, inserts()[0].params[0], "author");
  state.rows = [[["owner"]], []];
  state.push.mockRejectedValue(new Error("Admission intent failed"));
  await expect(
    publicationNotice(db as unknown as Tx, item, "owner", "archived", "audit"),
  ).rejects.toThrow("Admission intent failed");
  warn.mockRestore();
});
it.each(["created", "edited", "published", "archived", "restored"])(
  "localizes template %s in RU and EN while leaving unrelated notices intact",
  (event) => {
    const copy = { approved: "", rejected: "", version: "", notes: "" },
      notice = { title: "Publication activity", message: `Publication item: ${event}.` };
    expect(formatNotification(notice, copy, "ru").title).toBe("Обновление публикации");
    expect(formatNotification(notice, copy, "ru").message).not.toContain("Publication");
    expect(formatNotification(notice, copy, "en").message).not.toBe(notice.message);
    expect(formatNotification({ title: "Other", message: notice.message }, copy, "ru")).toEqual({
      title: "Other",
      message: notice.message,
    });
  },
);
it("notifies the current context owner of an author's restore using only a private editor link and localized draft status", async () => {
  state.rows = [[["owner"]], []];
  await publicationNotice(db as unknown as Tx, item, "author", "restored", "restore-audit");
  expect(inserts()).toHaveLength(1);
  expect(inserts()[0].params).toContain("/workspace/organizations/org/content/item");
  expect(inserts()[0].params).toContain("Publication item: restored.");
  const notice = { title: "Publication activity", message: "Publication item: restored." },
    copy = { approved: "", rejected: "", version: "", notes: "" };
  expect(formatNotification(notice, copy, "en").message).toContain("remains private");
  expect(formatNotification(notice, copy, "ru").message).toContain("остаётся непубличной");
});

it("notifies the current personal server owner and never its former organization", async () => {
  state.rows = [[["current-owner", null]], []];
  await publicationNotice(
    db as unknown as Tx,
    { ...item, organizationId: "former-org", serverId: "srv" },
    "author",
    "restored",
    "audit",
  );
  expect(state.queries.some((query) => query.sql.includes('from "organizations"'))).toBe(false);
  expect(inserts()).toHaveLength(1);
  expect(inserts()[0].params).toContain("current-owner");
  expect(inserts()[0].params).toContain("/workspace/servers/srv/content/item");
  expect(JSON.stringify(state.queries)).not.toContain("former-org");
});
