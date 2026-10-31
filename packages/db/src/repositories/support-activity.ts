import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { AppError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents } from "../schema";
import { supportAccess } from "./support-access";
class SupportActivityRepository {
  async history(id: string, actorId: string, before?: string) {
    if (before && !/^[a-zA-Z0-9_-]{1,128}$/u.test(before))
      throw new AppError("Invalid cursor", 400, "VALIDATION_ERROR");
    return db.transaction(
      async (tx) => {
        await supportAccess(tx, id, actorId, false);
        // Status timeline only: message audits lack from/to and belong in the thread UI /
        // Security Center projection, not this status-change feed.
        const scope = and(
          eq(auditEvents.targetType, "support_case"),
          eq(auditEvents.targetId, id),
          eq(auditEvents.action, "support.case.status_changed"),
          sql`${auditEvents.details}->>'from' in ('open','resolved','closed') and ${auditEvents.details}->>'to' in ('open','resolved','closed') and ${auditEvents.details}->>'from' <> ${auditEvents.details}->>'to'`,
        );
        let older: SQL | undefined;
        if (before) {
          const [anchor] = await tx
            .select({
              id: auditEvents.id,
              time: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(auditEvents)
            .where(and(scope, eq(auditEvents.id, before)))
            .limit(1);
          if (!anchor) throw new AppError("Activity page expired", 404, "SUPPORT_ACTIVITY_EXPIRED");
          older = sql`(${auditEvents.createdAt}, ${auditEvents.id}) < (${anchor.time}::timestamptz, ${anchor.id})`;
        }
        const rows = await tx
          .select({
            id: auditEvents.id,
            from: sql<string>`${auditEvents.details}->>'from'`,
            to: sql<string>`${auditEvents.details}->>'to'`,
            by: sql<
              "staff" | "requester"
            >`case when ${auditEvents.actorType} = 'admin' then 'staff' else 'requester' end`,
            createdAt: auditEvents.createdAt,
          })
          .from(auditEvents)
          .where(and(scope, older))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const items = rows.slice(0, 20);
        return { items, nextCursor: rows.length > 20 ? (items.at(-1)?.id ?? null) : null };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const supportActivityRepository = new SupportActivityRepository();
