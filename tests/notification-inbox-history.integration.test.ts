import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";

const active = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../packages/db/src/client", async (originalImport) => {
  const original = await originalImport<typeof import("../packages/db/src/client")>();
  return {
    ...original,
    db: new Proxy(original.db, {
      get(target, key) {
        const database = (active.db ?? target) as typeof target,
          value = Reflect.get(database, key);
        return typeof value === "function" ? value.bind(database) : value;
      },
    }),
  };
});

import { NotificationRepository } from "../packages/db/src/repositories/notifications";

const repository = new NotificationRepository();
const filters = { query: "", state: "all" as const, category: "all" };
type Transaction = Parameters<
  Parameters<typeof import("../packages/db/src/client").db.transaction>[0]
>[0];
async function fixture(callback: (tx: Transaction) => Promise<void>) {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(async (tx) => {
    active.db = tx;
    try {
      await tx.execute(
        sql`CREATE TEMP TABLE notifications (LIKE public.notifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
      );
      await callback(tx);
    } finally {
      active.db = null;
    }
  });
}
it("traverses more than 100 own equal-time notifications in both directions with exact microseconds and a removed anchor", async () => {
  await fixture(async (tx) => {
    await tx.execute(
      sql`INSERT INTO notifications (id,recipient_id,title,message,created_at) SELECT 'notification_' || lpad(n::text,4,'0'),'actor','Title','Message','2026-10-11T00:00:00Z'::timestamptz + (n / 3) * interval '1 microsecond' FROM generate_series(1,140) n`,
    );
    await tx.execute(
      sql`INSERT INTO notifications (id,recipient_id,title,message) VALUES ('foreign','other','Secret','Secret')`,
    );
    const expected = await tx.execute(
      sql`SELECT id FROM notifications WHERE recipient_id='actor' ORDER BY created_at DESC,id DESC`,
    );
    let page = await repository.pageInbox("actor", filters);
    const first = page.items.map((item) => item.id),
      seen = [...first];
    expect(page.items.every((item) => /\.\d{6}Z$/u.test(item.createdAt))).toBe(true);
    expect(page.unreadCount).toBe(140);
    const firstOlder = page.olderCursor;
    if (!firstOlder) throw Error("Missing older cursor");
    while (page.olderCursor) {
      page = await repository.pageInbox("actor", {
        ...filters,
        cursor: JSON.parse(page.olderCursor),
      });
      seen.push(...page.items.map((item) => item.id));
    }
    expect(seen).toEqual(expected.map((row) => row.id));
    expect(new Set(seen).size).toBe(140);
    const second = await repository.pageInbox("actor", {
      ...filters,
      cursor: JSON.parse(firstOlder),
    });
    expect(
      (
        await repository.pageInbox("actor", {
          ...filters,
          cursor: JSON.parse(second.newerCursor ?? ""),
        })
      ).items.map((item) => item.id),
    ).toEqual(first);
    const anchor = JSON.parse(firstOlder);
    await tx.execute(sql`DELETE FROM notifications WHERE id=${anchor.id}`);
    expect(
      (await repository.pageInbox("actor", { ...filters, cursor: anchor })).items.map(
        (item) => item.id,
      ),
    ).toEqual(second.items.map((item) => item.id));
    await expect(
      repository.pageInbox("other", { ...filters, cursor: anchor }),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
  });
});
it("filters literal search and category, bounds legacy Unicode text and preserves unknown structured data privately", async () => {
  await fixture(async (tx) => {
    await tx.execute(
      sql`INSERT INTO notifications (id,recipient_id,title,message,category,is_read,data) VALUES ('literal','actor','100%_\\','Message','content',false,null),('wildcard','actor','100ANY','Message','content',false,null),('read','actor','100%_\\','Message','content',true,null),('server','actor','100%_\\','Message','server',false,null),('huge','actor',repeat('😀',600),repeat('😀',9000),'system',false,jsonb_build_object('legacy',repeat('x',17000)))`,
    );
    const found = await repository.pageInbox("actor", {
      query: "%_\\",
      state: "unread",
      category: "content",
    });
    expect(found.items.map((item) => item.id)).toEqual(["literal"]);
    expect(found.unreadCount).toBe(4);
    const huge = (await repository.pageInbox("actor", { ...filters, category: "system" })).items[0];
    expect(Array.from(huge.title)).toHaveLength(512);
    expect(Array.from(huge.message)).toHaveLength(8192);
    expect(huge.truncated).toBe(true);
    expect(huge.data).toBeNull();
  });
});
it("rolls back a partially owned or stale selection and changes only explicit owned reading flags", async () => {
  await fixture(async (tx) => {
    await tx.execute(
      sql`INSERT INTO notifications (id,recipient_id,title,message,is_read,data) VALUES ('owned','actor','Title','Message',false,'{"legacy":"unchanged"}'),('second','actor','Title','Message',true,null),('foreign','other','Secret','Secret',false,null)`,
    );
    await expect(
      repository.setInboxReadState("actor", {
        isRead: true,
        items: [
          { id: "owned", expectedIsRead: false },
          { id: "foreign", expectedIsRead: false },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      repository.setInboxReadState("actor", {
        isRead: true,
        items: [
          { id: "owned", expectedIsRead: false },
          { id: "second", expectedIsRead: false },
        ],
      }),
    ).rejects.toMatchObject({ code: "NOTIFICATION_STATE_CHANGED" });
    expect(await repository.countUnread("actor")).toBe(1);
    await repository.setInboxReadState("actor", {
      isRead: false,
      items: [
        { id: "owned", expectedIsRead: false },
        { id: "second", expectedIsRead: true },
      ],
    });
    expect(await repository.countUnread("actor")).toBe(2);
    expect(await repository.countUnread("other")).toBe(1);
    const [stored] = await tx.execute(
      sql`SELECT title,message,data FROM notifications WHERE id='owned'`,
    );
    expect(stored).toMatchObject({
      title: "Title",
      message: "Message",
      data: { legacy: "unchanged" },
    });
  });
});
