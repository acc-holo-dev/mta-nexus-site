import { createHash } from "node:crypto";
import {
  AppError,
  type ChangeHistoryFilters,
  ForbiddenError,
  NotFoundError,
  REPORT_HISTORY_ACTIONS,
  REPORT_HISTORY_GROUPS,
  type ReportHistoryGroup,
} from "@nexus/domain";
import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, comments, content, reports, users } from "../schema";
import {
  discussionManagementRepository,
  moderationDiscussionRevision,
} from "./discussion-management";
import {
  changeHistoryBounds,
  changeHistoryContext,
  changeHistoryWindow,
} from "./private-change-history-window";
import { containsPattern } from "./search-pattern";

type Session = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;
type Scope = { actorId: string; staff: boolean };
type Status = "open" | "under_review" | "resolved" | "dismissed";
const editorialId = sql<
  string | null
>`case when ${content.type} in ('article','news','devlog','update','announcement','post','question','review') and ${content.status} in ('draft','published','archived') then ${content.id} else null end`;
const fields = {
  id: reports.id,
  targetType: reports.targetType,
  targetId: reports.targetId,
  type: reports.type,
  reason: sql<string>`left(${reports.reason},1000)`,
  evidenceUrls: reports.evidenceUrls,
  status: reports.status,
  createdAt: reports.createdAt,
  resolvedAt: reports.resolvedAt,
};
// Existing commercial reviews share comments. They are never actionable here.
const communityTarget = sql`(${reports.targetType} = 'content' or (${reports.targetType} = 'comment' and
  (exists (select 1 from ${comments} where ${comments.id} = ${reports.targetId} and ${comments.contentId} is not null and ${comments.productId} is null)
  or not exists (select 1 from ${comments} where ${comments.id} = ${reports.targetId}))))`;

async function requireStaff(tx: Session, actorId: string, lock = true) {
  const query = tx.select({ role: users.role }).from(users).where(eq(users.id, actorId));
  const [actor] = await (lock ? query.for("share") : query).limit(1);
  if (!actor || !["admin", "moderator"].includes(actor.role)) throw new ForbiddenError();
}

async function targetPreview(tx: Session, targetType: string, targetId: string, staff: boolean) {
  if (targetType === "content") {
    const [row] = await tx
      .select({
        id: content.id,
        slug: content.slug,
        title: content.title,
        text: sql<string>`left(${content.body}, 5000)`,
        truncated: sql<boolean>`length(${content.body}) > 5000`,
        status: content.status,
        author: users.username,
        moderationContentId: editorialId,
      })
      .from(content)
      .leftJoin(users, eq(users.id, content.authorId))
      .where(and(eq(content.id, targetId), staff ? undefined : eq(content.status, "published")))
      .limit(1);
    return row ? { ...row, kind: "content" as const, revision: null } : null;
  }
  const [row] = await tx
    .select({
      id: comments.id,
      slug: content.slug,
      title: content.title,
      text: sql<string>`left(${comments.text},5000)`,
      truncated: sql<boolean>`length(${comments.text}) > 5000`,
      status: content.status,
      author: users.username,
      contentId: content.id,
      digest: sql<string>`encode(sha256(convert_to(${comments.text},'UTF8')),'hex')`,
      moderationContentId: editorialId,
    })
    .from(comments)
    .innerJoin(content, eq(content.id, comments.contentId))
    .leftJoin(users, eq(users.id, comments.authorId))
    .where(
      and(
        eq(comments.id, targetId),
        isNull(comments.productId),
        staff ? undefined : eq(content.status, "published"),
      ),
    )
    .limit(1);
  return row
    ? {
        ...row,
        kind: "comment" as const,
        revision: moderationDiscussionRevision(row.contentId, row.id, row.digest),
      }
    : null;
}

type BatchInput = {
  items: { id: string; expectedStatus: "open" | "under_review" }[];
  action: "review" | "resolve" | "dismiss";
  notes: string;
};
function decisionStatus(action: string): Exclude<Status, "open"> {
  return action === "review" ? "under_review" : action === "dismiss" ? "dismissed" : "resolved";
}
function assertDecisionState(status: string, expected: string, action: string) {
  if (
    !["open", "under_review"].includes(status) ||
    status !== expected ||
    (action === "review" && status !== "open")
  )
    throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
}
class CommunityReportsRepository {
  async history(scope: Scope, id: string, filters: ChangeHistoryFilters<ReportHistoryGroup>) {
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

  private async discussionBatchPlan(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    actorId: string,
    contentId: string,
    commentId: string,
    input: BatchInput,
    write: boolean,
  ) {
    if (
      !/^[a-zA-Z0-9_-]{1,128}$/u.test(contentId) ||
      !/^[a-zA-Z0-9_-]{1,128}$/u.test(commentId) ||
      !Array.isArray(input.items) ||
      !input.items.length ||
      input.items.length > 20 ||
      new Set(input.items.map((item) => item.id)).size !== input.items.length ||
      input.items.some(
        (item) =>
          !/^[a-zA-Z0-9_-]{1,128}$/u.test(item.id) ||
          !["open", "under_review"].includes(item.expectedStatus),
      ) ||
      !["review", "resolve", "dismiss"].includes(input.action) ||
      typeof input.notes !== "string" ||
      input.notes.trim().length < 3 ||
      input.notes.length > 2000
    )
      throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    // Match comment deletion lock order, and keep live grants until commit.
    await requireStaff(tx, actorId, false);
    const [publication] = await tx
      .select({
        id: content.id,
        status: content.status,
        title: sql<string>`left(${content.title},200)`,
      })
      .from(content)
      .where(and(eq(content.id, contentId), sql`${editorialId} is not null`))
      .for("share")
      .limit(1);
    if (!publication) throw new NotFoundError("Publication");
    const [comment] = await tx
      .select({
        id: comments.id,
        text: sql<string>`left(${comments.text},5000)`,
        truncated: sql<boolean>`length(${comments.text}) > 5000`,
        digest: sql<string>`encode(sha256(convert_to(${comments.text},'UTF8')),'hex')`,
      })
      .from(comments)
      .where(
        and(
          eq(comments.id, commentId),
          eq(comments.contentId, contentId),
          isNull(comments.productId),
        ),
      )
      .for("share")
      .limit(1);
    if (!comment) {
      const [proof] = await tx
        .select({ id: auditEvents.id })
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.targetType, "comment"),
            eq(auditEvents.targetId, commentId),
            eq(auditEvents.action, "content.comment_removed"),
            sql`${auditEvents.details}->>'contentId' = ${contentId}`,
          ),
        )
        .limit(1);
      if (!proof) throw new NotFoundError("Comment");
    }
    await requireStaff(tx, actorId);
    const ids = input.items.map((item) => item.id).sort();
    const rows = await tx
      .select({
        id: reports.id,
        status: reports.status,
        type: reports.type,
        reason: sql<string>`left(${reports.reason},1000)`,
        createdAt: reports.createdAt,
        digest: sql<string>`encode(sha256(convert_to(jsonb_build_array(${reports.targetType},${reports.targetId},${reports.reporterId},${reports.type},${reports.reason},${reports.evidenceUrls},${reports.status},${reports.moderatorNotes},to_char(${reports.createdAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),to_char(${reports.resolvedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text,'UTF8')),'hex')`,
        reporterId: reports.reporterId,
      })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, "comment"),
          eq(reports.targetId, commentId),
          inArray(reports.id, ids),
        ),
      )
      .orderBy(asc(reports.id))
      .for(write ? "update" : "share");
    if (rows.length !== ids.length) throw new NotFoundError("Report");
    for (const row of rows)
      assertDecisionState(
        row.status,
        input.items.find((item) => item.id === row.id)?.expectedStatus ?? "",
        input.action,
      );
    const previewRevision = createHash("sha256")
      .update(
        JSON.stringify([
          1,
          "discussion-report-batch",
          actorId,
          contentId,
          commentId,
          publication.status,
          publication.title,
          comment?.digest ?? null,
          input.action,
          input.notes.trim(),
          rows.map((row) => [row.id, row.digest]),
        ]),
      )
      .digest("hex");
    return {
      publication,
      comment: comment
        ? {
            id: comment.id,
            text: comment.text,
            truncated: comment.truncated,
            revision: moderationDiscussionRevision(contentId, comment.id, comment.digest),
          }
        : null,
      rows,
      status: decisionStatus(input.action),
      previewRevision,
    };
  }
  async previewDiscussionBatch(
    actorId: string,
    contentId: string,
    commentId: string,
    input: BatchInput,
  ) {
    return db.transaction(async (tx) => {
      const plan = await this.discussionBatchPlan(tx, actorId, contentId, commentId, input, false);
      return {
        contentId,
        commentId,
        publication: plan.publication,
        comment: plan.comment,
        action: input.action,
        notes: input.notes.trim(),
        previewRevision: plan.previewRevision,
        items: plan.rows.map((row) => ({
          id: row.id,
          type: row.type,
          reason: row.reason,
          createdAt: row.createdAt,
          before: row.status,
          after: plan.status,
        })),
      };
    });
  }
  async decideDiscussionBatch(
    actorId: string,
    contentId: string,
    commentId: string,
    input: BatchInput & { previewRevision: string },
    auditIds: string[],
  ) {
    if (
      !/^[a-f0-9]{64}$/u.test(input.previewRevision) ||
      !Array.isArray(input.items) ||
      !Array.isArray(auditIds) ||
      auditIds.length !== input.items.length ||
      new Set(auditIds).size !== auditIds.length ||
      auditIds.some((id) => !/^[a-zA-Z0-9_-]{1,128}$/u.test(id))
    )
      throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    return db.transaction(async (tx) => {
      const plan = await this.discussionBatchPlan(tx, actorId, contentId, commentId, input, true);
      if (plan.previewRevision !== input.previewRevision)
        throw new AppError("Report review changed", 409, "REPORT_BATCH_CHANGED");
      const stored = await tx
        .update(reports)
        .set({
          status: plan.status,
          moderatorNotes: input.notes.trim(),
          resolvedAt: plan.status === "under_review" ? null : new Date(),
        })
        .where(
          and(
            eq(reports.targetType, "comment"),
            eq(reports.targetId, commentId),
            inArray(
              reports.id,
              plan.rows.map((row) => row.id),
            ),
          ),
        )
        .returning({ id: reports.id, status: reports.status });
      if (
        stored.length !== plan.rows.length ||
        stored.some(
          (row) =>
            row.status !== plan.status || !plan.rows.some((expected) => expected.id === row.id),
        )
      )
        throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
      await tx.insert(auditEvents).values(
        plan.rows.map((row, index) => ({
          id: auditIds[index],
          actorId,
          actorType: "admin",
          action: `report.${input.action}`,
          targetType: "report",
          targetId: row.id,
          details: {
            notes: input.notes.trim(),
            previousStatus: row.status,
            status: plan.status,
            removedCommentId: null,
            contentId,
            commentId,
            previewRevision: plan.previewRevision,
            batchSize: plan.rows.length,
          },
        })),
      );
      return {
        contentId,
        commentId,
        action: input.action,
        previewRevision: plan.previewRevision,
        items: plan.rows.map((row) => ({
          id: row.id,
          status: plan.status,
          reporterId: row.reporterId,
        })),
      };
    });
  }

  async submit(input: {
    actorId: string;
    id: string;
    auditId: string;
    targetType: "content" | "comment";
    targetId: string;
    type: string;
    reason: string;
    evidenceUrls: string[];
  }) {
    return db.transaction(async (tx) => {
      const lockKey = `report:${input.actorId}:${input.targetType}:${input.targetId}`;
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);
      // Lock the publication first, matching discussion creation/edit/removal.
      const publicationFilter =
        input.targetType === "content"
          ? eq(content.id, input.targetId)
          : sql`${content.id} in (select ${comments.contentId} from ${comments} where ${comments.id} = ${input.targetId} and ${comments.productId} is null)`;
      const [publication] = await tx
        .select({ id: content.id, authorId: content.authorId })
        .from(content)
        .where(and(publicationFilter, eq(content.status, "published")))
        .for("share")
        .limit(1);
      if (!publication) throw new NotFoundError("Report target");
      let authorId = publication.authorId;
      if (input.targetType === "comment") {
        const [comment] = await tx
          .select({ authorId: comments.authorId })
          .from(comments)
          .where(
            and(
              eq(comments.id, input.targetId),
              eq(comments.contentId, publication.id),
              isNull(comments.productId),
            ),
          )
          .for("share")
          .limit(1);
        if (!comment) throw new NotFoundError("Report target");
        authorId = comment.authorId;
      }
      if (authorId === input.actorId) throw new AppError("Own target", 422, "REPORT_OWN_TARGET");
      const [existing] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.reporterId, input.actorId),
            eq(reports.targetType, input.targetType),
            eq(reports.targetId, input.targetId),
            inArray(reports.status, ["open", "under_review"]),
          ),
        )
        .limit(1);
      if (existing) return { id: existing.id, created: false };
      await tx.insert(reports).values({
        id: input.id,
        reporterId: input.actorId,
        targetType: input.targetType,
        targetId: input.targetId,
        type: input.type,
        reason: input.reason,
        evidenceUrls: input.evidenceUrls,
        status: "open",
      });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "user",
        action: "report.created",
        targetType: "report",
        targetId: input.id,
        details: { targetType: input.targetType, contentId: publication.id, type: input.type },
      });
      return { id: input.id, created: true };
    });
  }

  async page(
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
        .select(fields)
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

  async detail(scope: Scope, id: string) {
    return db.transaction(async (tx) => {
      if (scope.staff) await requireStaff(tx, scope.actorId);
      const [row] = await tx
        .select({
          ...fields,
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

  async decide(input: {
    id: string;
    actorId: string;
    expectedStatus: "open" | "under_review";
    action: "review" | "resolve" | "dismiss" | "remove_comment";
    notes: string;
    expectedRevision?: string;
    auditId: string;
    removalAuditId: string;
  }) {
    return db.transaction(async (tx) => {
      // Recheck stale sessions before inspecting a target; the final role lock
      // follows publication/comment locks so discussion writers cannot deadlock.
      await requireStaff(tx, input.actorId, false);
      const [hint] = await tx
        .select({ targetType: reports.targetType, targetId: reports.targetId })
        .from(reports)
        .where(eq(reports.id, input.id))
        .limit(1);
      if (!hint) throw new NotFoundError("Report");
      type Current = {
        id: string;
        status: string;
        reporterId: string;
        targetId: string;
        targetType: string;
      };
      let current: Current | undefined;
      const lockReport = async (commentId?: string) => {
        const [row] = await tx
          .select({
            id: reports.id,
            status: reports.status,
            reporterId: reports.reporterId,
            targetId: reports.targetId,
            targetType: reports.targetType,
          })
          .from(reports)
          .where(and(eq(reports.id, input.id), communityTarget))
          .for("update")
          .limit(1);
        if (!row) throw new NotFoundError("Report");
        assertDecisionState(row.status, input.expectedStatus, input.action);
        if (commentId && (row.targetType !== "comment" || row.targetId !== commentId))
          throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
        current = row;
      };
      const removed = input.action === "remove_comment";
      if (removed) {
        if (hint?.targetType !== "comment")
          throw new AppError("Not a community comment", 422, "REPORT_TARGET_UNAVAILABLE");
        let lockingReport = false;
        try {
          await discussionManagementRepository.mutateWithin(
            tx,
            {
              actorId: input.actorId,
              commentId: hint.targetId,
              reportId: input.id,
              moderationWorkspace: true,
              expectedRevision: input.expectedRevision ?? "",
              reason: input.notes,
              auditId: input.removalAuditId,
            },
            async (scope) => {
              lockingReport = true;
              await lockReport(scope.commentId);
            },
          );
        } catch (error) {
          if (error instanceof NotFoundError && !lockingReport)
            throw new AppError("Target unavailable", 409, "REPORT_TARGET_UNAVAILABLE");
          throw error;
        }
      } else {
        await requireStaff(tx, input.actorId);
        await lockReport();
      }
      if (!current) throw new NotFoundError("Report");
      const status = decisionStatus(input.action);
      await tx
        .update(reports)
        .set({
          status,
          moderatorNotes: input.notes,
          resolvedAt: status === "under_review" ? null : new Date(),
        })
        .where(eq(reports.id, current.id));
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.actorId,
        actorType: "admin",
        action: `report.${input.action}`,
        targetType: "report",
        targetId: current.id,
        details: {
          notes: input.notes,
          previousStatus: current.status,
          status,
          removedCommentId: removed ? current.targetId : null,
        },
      });
      return {
        id: current.id,
        status,
        action: input.action,
        reporterId: current.reporterId,
        removed,
      };
    });
  }
}
export const communityReportsRepository = new CommunityReportsRepository();
