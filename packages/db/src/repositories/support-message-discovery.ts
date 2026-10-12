import { AppError, SUPPORT_MESSAGE_GROUPS, type SupportMessageFilters } from "@nexus/domain";
import { and, asc, desc, eq, ilike, sql } from "drizzle-orm";
import { db } from "../client";
import { supportCaseMessages } from "../schema";
import { changeHistoryContext, changeHistoryWindow } from "./private-change-history-window";
import { containsPattern } from "./search-pattern";
import { supportAccess } from "./support-access";

const messageId = (value: string) => /^spm_[a-f0-9]{24}$/u.test(value);
const messageTime = sql<string>`to_char(${supportCaseMessages.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
export const supportMessageDiscoveryRepository = {
  async page(caseId: string, actorId: string, filters: SupportMessageFilters, staffOnly = false) {
    if (!/^sup_[a-f0-9]{24}$/u.test(caseId))
      throw new AppError("Support case not found", 404, "NOT_FOUND");
    const history = { ...filters, period: "all" as const };
    const context = changeHistoryContext(
      "support-messages",
      actorId,
      caseId,
      SUPPORT_MESSAGE_GROUPS,
      history,
    );
    if (
      (filters.cursor &&
        (!messageId(filters.cursor.id) ||
          !["older", "newer"].includes(filters.cursor.direction))) ||
      (filters.focus &&
        (!messageId(filters.focus) || filters.cursor || filters.query || filters.group !== "all"))
    )
      throw new AppError("Invalid message filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
    return db.transaction(
      async (tx) => {
        const { actor, supportCase } = await supportAccess(tx, caseId, actorId, false);
        if (staffOnly && !actor.staff) throw new AppError("Staff required", 403, "FORBIDDEN");
        const until = await changeHistoryWindow(tx, history);
        const scope = and(
          eq(supportCaseMessages.caseId, caseId),
          sql`${supportCaseMessages.createdAt} <= ${until}::timestamptz`,
          filters.group !== "all" ? eq(supportCaseMessages.authorRole, filters.group) : undefined,
          filters.query
            ? ilike(supportCaseMessages.body, containsPattern(filters.query))
            : undefined,
        );
        const anchorId = filters.cursor?.id ?? filters.focus;
        let anchor: { id: string; createdAt: string } | undefined;
        if (anchorId) {
          [anchor] = await tx
            .select({ id: supportCaseMessages.id, createdAt: messageTime })
            .from(supportCaseMessages)
            .where(and(scope, eq(supportCaseMessages.id, anchorId)))
            .limit(1);
          if (!anchor)
            throw new AppError(
              "Message no longer available",
              filters.focus ? 404 : 410,
              filters.focus ? "SUPPORT_MESSAGE_NOT_FOUND" : "SUPPORT_MESSAGES_EXPIRED",
            );
        }
        const newer = filters.cursor?.direction === "newer";
        const position = sql`(${supportCaseMessages.createdAt}, ${supportCaseMessages.id})`;
        const boundary = anchor
          ? newer
            ? sql`${position} > (${anchor.createdAt}::timestamptz, ${anchor.id})`
            : filters.focus
              ? sql`${position} <= (${anchor.createdAt}::timestamptz, ${anchor.id})`
              : sql`${position} < (${anchor.createdAt}::timestamptz, ${anchor.id})`
          : undefined;
        const rows = await tx
          .select({
            id: supportCaseMessages.id,
            authorRole: supportCaseMessages.authorRole,
            body: sql<string>`left(${supportCaseMessages.body},4000)`,
            truncated: sql<boolean>`length(${supportCaseMessages.body}) > 4000`,
            createdAt: messageTime,
          })
          .from(supportCaseMessages)
          .where(and(scope, boundary))
          .orderBy(
            newer ? asc(supportCaseMessages.createdAt) : desc(supportCaseMessages.createdAt),
            newer ? asc(supportCaseMessages.id) : desc(supportCaseMessages.id),
          )
          .limit(20);
        const items = (newer ? rows : rows.reverse()).map((row) => ({
          ...row,
          body: row.body.slice(0, 4000).replace(/[\uD800-\uDBFF]$/u, ""),
          truncated: row.truncated || row.body.length > 4000,
        }));
        const first = items[0],
          last = items.at(-1);
        let olderCursor = null,
          newerCursor = null;
        if (first && last) {
          const [edges] = await tx
            .select({
              older: sql<boolean>`exists(select 1 from ${supportCaseMessages} where ${scope} and ${position} < (${first.createdAt}::timestamptz,${first.id}))`,
              newer: sql<boolean>`exists(select 1 from ${supportCaseMessages} where ${scope} and ${position} > (${last.createdAt}::timestamptz,${last.id}))`,
            })
            .from(sql`(select 1) as support_message_edges`)
            .limit(1);
          if (edges?.older)
            olderCursor = {
              version: 1 as const,
              context,
              until,
              id: first.id,
              direction: "older" as const,
            };
          if (edges?.newer)
            newerCursor = {
              version: 1 as const,
              context,
              until,
              id: last.id,
              direction: "newer" as const,
            };
        }
        return {
          supportCase: {
            id: supportCase.id,
            subject: supportCase.subject.slice(0, 120),
            status: supportCase.status,
          },
          items,
          until,
          olderCursor,
          newerCursor,
          focus: filters.focus ?? null,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  },
};
