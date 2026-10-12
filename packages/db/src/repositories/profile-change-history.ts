import {
  AppError,
  type ChangeHistoryFilters,
  NotFoundError,
  PROFILE_CHANGE_ACTIONS,
  PROFILE_CHANGE_FIELDS,
  PROFILE_CHANGE_GROUPS,
  type ProfileChangeGroup,
} from "@nexus/domain";
import { and, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, users } from "../schema";
import {
  changeHistoryBounds,
  changeHistoryContext,
  changeHistoryWindow,
} from "./private-change-history-window";
export class ProfileChangeHistoryRepository {
  async page(actorId: string, filters: ChangeHistoryFilters<ProfileChangeGroup>) {
    const context = changeHistoryContext(
      "profile-change-history",
      actorId,
      actorId,
      PROFILE_CHANGE_GROUPS,
      filters,
    );
    if (filters.query || filters.before)
      throw new AppError("Invalid profile history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
    return db.transaction(
      async (tx) => {
        const [actor] = await tx
          .select({ username: users.username })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1);
        if (!actor) throw new NotFoundError("User");
        const until = await changeHistoryWindow(tx, filters);
        const selected =
          filters.group === "all"
            ? [...PROFILE_CHANGE_ACTIONS]
            : [
                filters.group === "profile"
                  ? "user.profile_updated"
                  : filters.group === "professional"
                    ? "developer.profile_updated"
                    : "user.privacy_updated",
              ];
        const scope = and(
          eq(auditEvents.targetType, "user"),
          eq(auditEvents.targetId, actorId),
          inArray(auditEvents.action, selected),
          changeHistoryBounds(auditEvents.createdAt, filters.period, until),
        );
        let before: SQL | undefined;
        if (filters.cursor) {
          const [anchor] = await tx
            .select({
              id: auditEvents.id,
              time: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            })
            .from(auditEvents)
            .where(and(scope, eq(auditEvents.id, filters.cursor.id)))
            .limit(1);
          if (!anchor) throw new AppError("Profile history expired", 404, "CHANGE_HISTORY_EXPIRED");
          before = sql`(${auditEvents.createdAt},${auditEvents.id})<(${anchor.time}::timestamptz,${anchor.id})`;
        }
        const rows = await tx
          .select({
            id: auditEvents.id,
            action: auditEvents.action,
            createdAt: sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
            fields: sql<
              string[]
            >`coalesce((select jsonb_agg(field.name order by field.ordinal) from jsonb_array_elements_text(${JSON.stringify(PROFILE_CHANGE_FIELDS)}::jsonb) with ordinality as field(name,ordinal) where (${auditEvents.action}='user.profile_updated' and field.ordinal<=3 or ${auditEvents.action}='developer.profile_updated' and field.ordinal between 4 and 6 or ${auditEvents.action}='user.privacy_updated' and field.ordinal>=7) and case when jsonb_typeof(${auditEvents.details}->'fields')='array' then ${auditEvents.details}->'fields' else '[]'::jsonb end ? field.name),'[]'::jsonb)`,
            experienceVerificationInvalidated: sql<boolean>`coalesce(${auditEvents.action}='developer.profile_updated' and ${auditEvents.details}->'experienceVerificationInvalidated'='true'::jsonb,false)`,
            actor: sql<
              "you" | "system"
            >`case when ${auditEvents.actorId}=${actorId} and ${auditEvents.actorType}='user' then 'you' else 'system' end`,
          })
          .from(auditEvents)
          .where(and(scope, before))
          .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
          .limit(21);
        const items = rows.slice(0, 20),
          last = items.at(-1);
        return {
          username: actor.username,
          period: filters.period,
          group: filters.group,
          until,
          items,
          hasMore: rows.length > 20,
          nextCursor:
            rows.length > 20 && last ? { version: 1 as const, context, until, id: last.id } : null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
}
export const profileChangeHistoryRepository = new ProfileChangeHistoryRepository();
