import { AppError, type CommunityReportGroupFilters } from "@nexus/domain";
import { and, asc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import { comments, content, reports } from "../schema";
import {
  changeHistoryBounds,
  changeHistoryContext,
  changeHistoryWindow,
} from "./private-change-history-window";
import { communityTarget, editorialId, requireStaff } from "./private-community-report-scope";
import { containsPattern } from "./search-pattern";

export async function listCommunityReportGroups(
  actorId: string,
  filters: CommunityReportGroupFilters,
) {
  if (
    !["pending", "history"].includes(filters.view) ||
    (filters.target && !["content", "comment"].includes(filters.target)) ||
    (filters.type && !/^[a-z_]{1,40}$/u.test(filters.type)) ||
    filters.before
  )
    throw new AppError("Invalid report group filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
  const context = changeHistoryContext(
    `community-report-groups:${filters.view}:${filters.target ?? ""}:${filters.type ?? ""}`,
    actorId,
    actorId,
    ["all"],
    filters,
  );
  return db.transaction(
    async (tx) => {
      await requireStaff(tx, actorId, false);
      const until = await changeHistoryWindow(tx, filters),
        pattern = filters.query ? containsPattern(filters.query) : undefined;
      const scope = and(
        communityTarget,
        sql`${reports.targetType} in ('content','comment')`,
        sql`${reports.targetId} ~ '^[A-Za-z0-9_-]{1,128}$'`,
        inArray(reports.status, ["open", "under_review", "resolved", "dismissed"]),
        changeHistoryBounds(reports.createdAt, filters.period, until),
        filters.target ? eq(reports.targetType, filters.target) : undefined,
        filters.type ? eq(reports.type, filters.type) : undefined,
        pattern ? or(ilike(reports.reason, pattern), ilike(reports.id, pattern)) : undefined,
      );
      const first = sql`min(${reports.createdAt})`,
        last = sql`max(${reports.createdAt})`;
      const eligible =
        filters.view === "pending"
          ? sql`count(*) filter (where ${reports.status} in ('open','under_review')) > 0`
          : sql`count(*) filter (where ${reports.status} in ('resolved','dismissed')) > 0`;
      let after: SQL | undefined;
      if (filters.cursor) {
        const [hint] = await tx
          .select({
            targetType: reports.targetType,
            targetId: reports.targetId,
            time: sql<string>`to_char(${reports.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          })
          .from(reports)
          .where(and(scope, eq(reports.id, filters.cursor.id)))
          .limit(1);
        const [anchor] = hint
          ? await tx
              .select({
                time: sql<string>`to_char(${first} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
              })
              .from(reports)
              .where(
                and(
                  scope,
                  eq(reports.targetType, hint.targetType),
                  eq(reports.targetId, hint.targetId),
                ),
              )
              .groupBy(reports.targetType, reports.targetId)
              .having(eligible)
              .limit(1)
          : [];
        if (!hint || !anchor || hint.time !== anchor.time)
          throw new AppError("Report group queue changed", 410, "REPORT_GROUPS_EXPIRED");
        after = sql`(${first},${reports.targetType},${reports.targetId}) > (${anchor.time}::timestamptz,${hint.targetType},${hint.targetId})`;
      }
      const rows = await tx
        .select({
          targetType: reports.targetType,
          targetId: reports.targetId,
          anchorId: sql<string>`substring(min((to_char(${reports.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') || ${reports.id}) collate "C") from 28)`,
          firstAt: sql<string>`to_char(${first} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          lastAt: sql<string>`to_char(${last} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          open: sql`count(*) filter (where ${reports.status}='open')`.mapWith(Number),
          review: sql`count(*) filter (where ${reports.status}='under_review')`.mapWith(Number),
          resolved: sql`count(*) filter (where ${reports.status}='resolved')`.mapWith(Number),
          dismissed: sql`count(*) filter (where ${reports.status}='dismissed')`.mapWith(Number),
        })
        .from(reports)
        .where(scope)
        .groupBy(reports.targetType, reports.targetId)
        .having(and(eligible, after))
        .orderBy(asc(first), asc(reports.targetType), asc(reports.targetId))
        .limit(21);
      const page = rows.slice(0, 20),
        contentIds = page.filter((row) => row.targetType === "content").map((row) => row.targetId),
        commentIds = page.filter((row) => row.targetType === "comment").map((row) => row.targetId);
      const publications = contentIds.length
        ? await tx
            .select({
              id: content.id,
              title: sql<string>`left(${content.title},200)`,
              status: content.status,
            })
            .from(content)
            .where(and(inArray(content.id, contentIds), sql`${editorialId} is not null`))
        : [];
      const discussion = commentIds.length
        ? await tx
            .select({
              id: comments.id,
              contentId: content.id,
              title: sql<string>`left(${content.title},200)`,
              text: sql<string>`left(${comments.text},160)`,
              status: content.status,
            })
            .from(comments)
            .innerJoin(content, eq(content.id, comments.contentId))
            .where(
              and(
                inArray(comments.id, commentIds),
                isNull(comments.productId),
                sql`${editorialId} is not null`,
              ),
            )
        : [];
      const items = page.map((row) => {
        const publication = publications.find((item) => item.id === row.targetId),
          comment = discussion.find((item) => item.id === row.targetId);
        return {
          ...row,
          target:
            row.targetType === "content" && publication
              ? {
                  contentId: publication.id,
                  title: publication.title,
                  status: publication.status,
                  text: null,
                }
              : row.targetType === "comment" && comment
                ? {
                    contentId: comment.contentId,
                    title: comment.title,
                    status: comment.status,
                    text: comment.text,
                  }
                : null,
        };
      });
      const tail = page.at(-1);
      return {
        period: filters.period,
        view: filters.view,
        query: filters.query,
        target: filters.target ?? null,
        type: filters.type ?? null,
        until,
        items,
        hasMore: rows.length > 20,
        nextCursor:
          rows.length > 20 && tail
            ? { version: 1 as const, context, until, id: tail.anchorId }
            : null,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
