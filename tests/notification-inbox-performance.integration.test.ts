import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";

const active = vi.hoisted(() => ({ db: null as unknown }));
vi.mock("../packages/db/src/client", async (importOriginal) => {
  const original = await importOriginal<typeof import("../packages/db/src/client")>();
  return {
    ...original,
    db: new Proxy(original.db, {
      get(target, key) {
        const database = (active.db ?? target) as typeof target;
        const value = Reflect.get(database, key);
        return typeof value === "function" ? value.bind(database) : value;
      },
    }),
  };
});
import { NotificationRepository } from "../packages/db/src/repositories/notifications";

it("measures inbox indexes on PostgreSQL and preserves recipient isolation and equal-time ordering", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(async (tx) => {
    active.db = tx;
    try {
      // Unqualified migration names resolve to this transaction-owned temporary table.
      await tx.execute(
        sql`CREATE TEMP TABLE notifications (LIKE public.notifications INCLUDING DEFAULTS INCLUDING CONSTRAINTS) ON COMMIT DROP`,
      );
      await tx.execute(sql`INSERT INTO notifications (id, recipient_id, title, message, is_read, created_at)
        SELECT 'inbox_' || lpad(n::text, 5, '0'),
          CASE WHEN n <= 125 THEN 'target-user' ELSE 'background-' || (n % 100) END,
          'Fixture', 'Fixture', n % 5 <> 0, '2026-01-01'::timestamptz
        FROM generate_series(1, 20125) n`);
      await tx.execute(sql`ANALYZE notifications`);
      const queries = {
        inbox:
          "SELECT * FROM notifications WHERE recipient_id = 'target-user' ORDER BY created_at DESC, id DESC LIMIT 20",
        unread:
          "SELECT * FROM notifications WHERE recipient_id = 'target-user' AND is_read = false ORDER BY created_at DESC, id DESC LIMIT 20",
        count:
          "SELECT count(*) FROM notifications WHERE recipient_id = 'target-user' AND is_read = false",
      };
      const plans = async () => {
        const result: Record<string, unknown> = {};
        for (const [name, query] of Object.entries(queries)) {
          const rows = await tx.execute(
            sql.raw(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`),
          );
          result[name] = rows[0]["QUERY PLAN"];
        }
        return result;
      };
      const before = await plans();
      for (const statement of readFileSync(
        "packages/db/migrations/0035_notification_inbox_indexes.sql",
        "utf8",
      ).split("--> statement-breakpoint")) {
        await tx.execute(sql.raw(statement));
      }
      await tx.execute(sql`ANALYZE notifications`);
      const after = await plans();
      expect(JSON.stringify(after.inbox)).toContain("notifications_recipient_created_id_idx");
      expect(JSON.stringify(after.unread)).toContain(
        "notifications_unread_recipient_created_id_idx",
      );
      expect(JSON.stringify(after.count)).toContain(
        "notifications_unread_recipient_created_id_idx",
      );
      const repository = new NotificationRepository();
      const id = (n: number) => `inbox_${String(n).padStart(5, "0")}`;
      expect((await repository.listByUser("target-user", 20)).map((row) => row.id)).toEqual(
        Array.from({ length: 20 }, (_, n) => id(125 - n)),
      );
      expect((await repository.listByUser("target-user", 20, true)).map((row) => row.id)).toEqual(
        Array.from({ length: 20 }, (_, n) => id(125 - n * 5)),
      );
      expect(await repository.countUnread("target-user")).toBe(25);
      const otherUnread = await repository.countUnread("background-0");
      expect(otherUnread).toBeGreaterThan(0);
      await repository.markAllAsRead("target-user");
      expect(await repository.countUnread("target-user")).toBe(0);
      expect(await repository.countUnread("background-0")).toBe(otherUnread);
      if (process.env.GITHUB_ACTIONS === "true") {
        mkdirSync("artifacts", { recursive: true });
        writeFileSync(
          "artifacts/notification-inbox-query-plans.json",
          JSON.stringify(
            {
              sha: process.env.GITHUB_SHA,
              status: "PASS",
              notifications: 20125,
              before,
              after,
              limitations:
                "Synthetic PostgreSQL fixture and warm cache; no production timing claim.",
            },
            null,
            2,
          ),
        );
      }
    } finally {
      active.db = null;
    }
  });
}, 30_000);
