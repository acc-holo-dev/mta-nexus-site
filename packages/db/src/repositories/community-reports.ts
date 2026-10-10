import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import { auditEvents, comments, content, reports, users } from "../schema";
import { discussionRevision } from "./discussion-management";

type Session = Pick<typeof db, "select" | "insert" | "update" | "delete" | "execute">;
type Scope = { actorId: string; staff: boolean };
type Status = "open" | "under_review" | "resolved" | "dismissed";
const fields = {
  id: reports.id,
  targetType: reports.targetType,
  targetId: reports.targetId,
  type: reports.type,
  reason: reports.reason,
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
      text: comments.text,
      truncated: sql<boolean>`length(${comments.text}) > 5000`,
      status: content.status,
      author: users.username,
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
    ? { ...row, kind: "comment" as const, revision: discussionRevision(row.id, row.text) }
    : null;
}

class CommunityReportsRepository {
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
    },
  ) {
    if (!Number.isSafeInteger(filters.page) || filters.page < 1 || filters.page > 9999)
      throw new RangeError("Invalid report page");
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
      return { ...row, target: await targetPreview(tx, row.targetType, row.targetId, scope.staff) };
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
      let removed: { id: string; contentId: string } | null = null;
      if (input.action === "remove_comment") {
        if (hint?.targetType !== "comment")
          throw new AppError("Not a community comment", 422, "REPORT_TARGET_UNAVAILABLE");
        const [publication] = await tx
          .select({ id: content.id })
          .from(content)
          .where(sql`${content.id} in
          (select ${comments.contentId} from ${comments} where ${comments.id} = ${hint.targetId} and ${comments.productId} is null)`)
          .for("update")
          .limit(1);
        if (!publication)
          throw new AppError("Target unavailable", 409, "REPORT_TARGET_UNAVAILABLE");
        const [comment] = await tx
          .select({ id: comments.id, text: comments.text })
          .from(comments)
          .where(
            and(
              eq(comments.id, hint.targetId),
              eq(comments.contentId, publication.id),
              isNull(comments.productId),
            ),
          )
          .for("update")
          .limit(1);
        if (!comment) throw new AppError("Target unavailable", 409, "REPORT_TARGET_UNAVAILABLE");
        if (discussionRevision(comment.id, comment.text) !== input.expectedRevision)
          throw new AppError("Comment changed", 409, "COMMENT_CHANGED");
        removed = { id: comment.id, contentId: publication.id };
      }
      await requireStaff(tx, input.actorId);
      const [current] = await tx
        .select({
          id: reports.id,
          status: reports.status,
          reporterId: reports.reporterId,
          targetId: reports.targetId,
        })
        .from(reports)
        .where(and(eq(reports.id, input.id), communityTarget))
        .for("update")
        .limit(1);
      if (!current) throw new NotFoundError("Report");
      if (
        !["open", "under_review"].includes(current.status) ||
        current.status !== input.expectedStatus ||
        (input.action === "review" && current.status !== "open")
      )
        throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
      if (removed && current.targetId !== removed.id)
        throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
      const status: Status =
        input.action === "review"
          ? "under_review"
          : input.action === "dismiss"
            ? "dismissed"
            : "resolved";
      if (removed) {
        await tx.delete(comments).where(eq(comments.id, removed.id));
        await tx
          .update(content)
          .set({ commentCount: sql`greatest(0, ${content.commentCount} - 1)` })
          .where(eq(content.id, removed.contentId));
        await tx.insert(auditEvents).values({
          id: input.removalAuditId,
          actorId: input.actorId,
          actorType: "admin",
          action: "content.comment_removed",
          targetType: "comment",
          targetId: removed.id,
          details: {
            contentId: removed.contentId,
            moderator: true,
            reason: input.notes,
            reportId: current.id,
          },
        });
      }
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
          removedCommentId: removed?.id ?? null,
        },
      });
      return {
        id: current.id,
        status,
        action: input.action,
        reporterId: current.reporterId,
        removed: !!removed,
      };
    });
  }
}
export const communityReportsRepository = new CommunityReportsRepository();
