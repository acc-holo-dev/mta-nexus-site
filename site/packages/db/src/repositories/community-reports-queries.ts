import {
  AppError,
  type ChangeHistoryFilters,
  type CommunityReportGroupFilters,
  NotFoundError,
  REPORT_HISTORY_ACTIONS,
  REPORT_HISTORY_GROUPS,
  type ReportHistoryGroup,
} from "@nexus/domain";
import { and, asc, desc, eq, ilike, inArray, or, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, content, reports } from "../schema";
import { targetPreview } from "./community-reports-shared";
import { reportListFields, type Scope, type Status } from "./community-reports-types";
import {
  changeHistoryBounds,
  changeHistoryContext,
  changeHistoryWindow,
} from "./private-change-history-window";
import { listCommunityReportGroups } from "./private-community-report-groups";
import { communityTarget, editorialId, requireStaff } from "./private-community-report-scope";
import { containsPattern } from "./search-pattern";

export function groups(actorId: string, filters: CommunityReportGroupFilters) {
  return listCommunityReportGroups(actorId, filters);
}

export async function publicationReports(
  actorId: string,
  contentId: string,
  filters: { view: "pending" | "history"; query: string; type?: string; page: number },
) {
  if (!/^[A-Za-z0-9_-]{1,128}$/u.test(contentId)) throw new NotFoundError("Publication");
  if (
    !Number.isSafeInteger(filters.page) ||
    filters.page < 1 ||
    filters.page > 9999 ||
    !["pending", "history"].includes(filters.view) ||
    typeof filters.query !== "string" ||
    filters.query.length > 80 ||
    filters.query !== filters.query.trim()
  )
    throw new AppError("Invalid report filters", 400, "VALIDATION_ERROR");
  return db.transaction(
    async (tx) => {
      await requireStaff(tx, actorId, false);
      const [publication] = await tx
        .select({
          id: content.id,
          title: sql<string>`left(${content.title},200)`,
          status: content.status,
          text: sql<string>`left(${content.body},5000)`,
          truncated: sql<boolean>`length(${content.body})>5000`,
        })
        .from(content)
        .where(and(eq(content.id, contentId), sql`${editorialId} is not null`))
        .limit(1);
      if (!publication) throw new NotFoundError("Publication");
      const pattern = filters.query ? containsPattern(filters.query) : undefined;
      const rows = await tx
        .select({
          id: reports.id,
          type: reports.type,
          reason: sql<string>`left(${reports.reason},1000)`,
          status: reports.status,
          createdAt: reports.createdAt,
          resolvedAt: reports.resolvedAt,
        })
        .from(reports)
        .where(
          and(
            eq(reports.targetType, "content"),
            eq(reports.targetId, contentId),
            inArray(
              reports.status,
              filters.view === "pending" ? ["open", "under_review"] : ["resolved", "dismissed"],
            ),
            filters.type ? eq(reports.type, filters.type) : undefined,
            pattern ? or(ilike(reports.reason, pattern), ilike(reports.id, pattern)) : undefined,
          ),
        )
        .orderBy(desc(reports.createdAt), desc(reports.id))
        .limit(21)
        .offset((filters.page - 1) * 20);
      return {
        publication,
        items: rows.slice(0, 20),
        hasMore: rows.length > 20,
        page: filters.page,
        view: filters.view,
      };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

export async function history(
  scope: Scope,
  id: string,
  filters: ChangeHistoryFilters<ReportHistoryGroup>,
) {
  const context = changeHistoryContext(
    scope.staff ? "community-report-staff-history" : "community-report-own-history",
    scope.actorId,
    id,
    REPORT_HISTORY_GROUPS,
    filters,
  );
  if (filters.query || filters.before)
    throw new AppError("Invalid report history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
  return db.transaction(
    async (tx) => {
      if (scope.staff) await requireStaff(tx, scope.actorId, false);
      const [report] = await tx
        .select({
          id: reports.id,
          targetType: reports.targetType,
          targetId: reports.targetId,
          type: reports.type,
          status: reports.status,
          reporterId: reports.reporterId,
        })
        .from(reports)
        .where(
          and(
            eq(reports.id, id),
            communityTarget,
            scope.staff ? undefined : eq(reports.reporterId, scope.actorId),
          ),
        )
        .limit(1);
      if (!report) throw new NotFoundError("Report");
      const until = await changeHistoryWindow(tx, filters);
      const actions =
        filters.group === "all"
          ? [...REPORT_HISTORY_ACTIONS]
          : filters.group === "submission"
            ? ["report.created"]
            : filters.group === "review"
              ? ["report.review"]
              : ["report.resolve", "report.dismiss", "report.remove_comment"];
      const where = and(
        eq(auditEvents.targetType, "report"),
        eq(auditEvents.targetId, id),
        inArray(auditEvents.action, actions),
        changeHistoryBounds(auditEvents.createdAt, filters.period, until),
      );
      const time = sql<string>`to_char(${auditEvents.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
      let before: SQL | undefined;
      if (filters.cursor) {
        const [anchor] = await tx
          .select({ id: auditEvents.id, time })
          .from(auditEvents)
          .where(and(where, eq(auditEvents.id, filters.cursor.id)))
          .limit(1);
        if (!anchor) throw new AppError("Report history expired", 410, "REPORT_HISTORY_EXPIRED");
        before = sql`(${auditEvents.createdAt},${auditEvents.id}) < (${anchor.time}::timestamptz,${anchor.id})`;
      }
      const rows = await tx
        .select({
          id: auditEvents.id,
          action: auditEvents.action,
          createdAt: time,
          from: sql<Status | null>`case when ${auditEvents.action}<>'report.created' and ${auditEvents.details}->>'previousStatus' in ('open','under_review','resolved','dismissed') then ${auditEvents.details}->>'previousStatus' else null end`,
          to: sql<Status | null>`case when ${auditEvents.action}='report.created' then 'open' when ${auditEvents.action}='report.review' and ${auditEvents.details}->>'status'='under_review' then 'under_review' when ${auditEvents.action} in ('report.resolve','report.remove_comment') and ${auditEvents.details}->>'status'='resolved' then 'resolved' when ${auditEvents.action}='report.dismiss' and ${auditEvents.details}->>'status'='dismissed' then 'dismissed' else null end`,
          by: sql<
            "requester" | "staff" | "unknown"
          >`case when ${auditEvents.actorType}='user' and ${auditEvents.actorId}=${report.reporterId} then 'requester' when ${auditEvents.actorType}='admin' then 'staff' else 'unknown' end`,
          removed: sql<boolean>`coalesce(${auditEvents.action}='report.remove_comment' and ${report.targetType}='comment' and jsonb_typeof(${auditEvents.details}->'removedCommentId')='string' and ${auditEvents.details}->>'removedCommentId'=${report.targetId},false)`,
          ...(scope.staff
            ? {
                notes: sql<
                  string | null
                >`case when jsonb_typeof(${auditEvents.details}->'notes')='string' then left(${auditEvents.details}->>'notes',2000) else null end`,
                batchSize: sql<
                  number | null
                >`case when jsonb_typeof(${auditEvents.details}->'batchSize')='number' and ${auditEvents.details}->>'batchSize' ~ '^([1-9]|1[0-9]|20)$' then (${auditEvents.details}->>'batchSize')::integer else null end`,
              }
            : {}),
        })
        .from(auditEvents)
        .where(and(where, before))
        .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
        .limit(21);
      const items = rows.slice(0, 20).map((row) => ({
        ...row,
        ...(scope.staff
          ? {
              notes: row.notes?.slice(0, 2000).replace(/[\uD800-\uDBFF]$/u, "") ?? null,
              batchSize: row.batchSize ?? null,
            }
          : {}),
      }));
      const last = items.at(-1);
      return {
        report: {
          id: report.id,
          targetType: report.targetType,
          type: report.type,
          status: report.status,
        },
        audience: scope.staff ? ("staff" as const) : ("requester" as const),
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

export async function page(
  scope: Scope,
  filters: {
    view: "pending" | "history";
    page: number;
    target?: "content" | "comment";
    type?: string;
    query?: string;
  },
) {
  if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > 9999)
    throw new RangeError("Invalid report page");
  if (
    filters.query !== undefined &&
    (typeof filters.query !== "string" ||
      filters.query.length > 80 ||
      filters.query !== filters.query.trim())
  )
    throw new AppError("Invalid report search", 400, "VALIDATION_ERROR");
  const pattern = filters.query ? containsPattern(filters.query) : undefined;
  return db.transaction(async (tx) => {
    if (scope.staff) await requireStaff(tx, scope.actorId);
    const rows = await tx
      .select(reportListFields)
      .from(reports)
      .where(
        and(
          communityTarget,
          scope.staff ? undefined : eq(reports.reporterId, scope.actorId),
          inArray(
            reports.status,
            filters.view === "pending" ? ["open", "under_review"] : ["resolved", "dismissed"],
          ),
          filters.target ? eq(reports.targetType, filters.target) : undefined,
          filters.type ? eq(reports.type, filters.type) : undefined,
          pattern ? or(ilike(reports.reason, pattern), ilike(reports.id, pattern)) : undefined,
        ),
      )
      .orderBy(
        ...(scope.staff && filters.view === "pending"
          ? [asc(reports.createdAt), asc(reports.id)]
          : [desc(reports.createdAt), desc(reports.id)]),
      )
      .limit(21)
      .offset((filters.page - 1) * 20);
    return { items: rows.slice(0, 20), hasMore: rows.length > 20 };
  });
}

export async function detail(scope: Scope, id: string) {
  return db.transaction(async (tx) => {
    if (scope.staff) await requireStaff(tx, scope.actorId);
    const [row] = await tx
      .select({
        ...reportListFields,
        ...(scope.staff
          ? { reporterId: reports.reporterId, moderatorNotes: reports.moderatorNotes }
          : {}),
      })
      .from(reports)
      .where(
        and(
          eq(reports.id, id),
          communityTarget,
          scope.staff ? undefined : eq(reports.reporterId, scope.actorId),
        ),
      )
      .limit(1);
    if (!row) throw new NotFoundError("Report");
    const target = await targetPreview(tx, row.targetType, row.targetId, scope.staff);
    let moderationContentId = scope.staff ? (target?.moderationContentId ?? null) : null;
    if (scope.staff && !target) {
      const [context] = await tx
        .select({ id: content.id })
        .from(auditEvents)
        .innerJoin(content, sql`${content.id} = ${auditEvents.details}->>'contentId'`)
        .where(
          and(
            eq(auditEvents.targetType, "report"),
            eq(auditEvents.targetId, id),
            eq(auditEvents.action, "report.created"),
            sql`${editorialId} is not null`,
          ),
        )
        .limit(1);
      moderationContentId = context?.id ?? null;
    }
    return { ...row, target, ...(scope.staff ? { moderationContentId } : {}) };
  });
}
