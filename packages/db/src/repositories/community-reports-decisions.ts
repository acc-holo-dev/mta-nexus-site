import { createHash } from "node:crypto";
import { AppError, NotFoundError } from "@nexus/domain";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, comments, content, reports } from "../schema";
import {
  assertDecisionState,
  decisionStatus,
  persistDecisionNotice,
} from "./community-reports-shared";
import type { BatchInput } from "./community-reports-types";
import {
  discussionManagementRepository,
  moderationDiscussionRevision,
} from "./discussion-management";
import { lockInitiatingSession } from "./initiating-session";
import { lockNotificationPreferencesForUsers } from "./notification-preference-lock";
import { communityTarget, editorialId, requireStaff } from "./private-community-report-scope";

async function targetBatchPlan(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  actorId: string,
  contentId: string,
  commentId: string | null,
  input: BatchInput,
  write: boolean,
) {
  if (
    !/^[a-zA-Z0-9_-]{1,128}$/u.test(contentId) ||
    (commentId !== null && !/^[a-zA-Z0-9_-]{1,128}$/u.test(commentId)) ||
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
      ...(commentId === null
        ? {
            text: sql<string>`left(${content.body},5000)`,
            truncated: sql<boolean>`length(${content.body})>5000`,
            digest: sql<string>`encode(sha256(convert_to(jsonb_build_array(${content.type},${content.title},${content.body},to_char(${content.updatedAt} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'))::text,'UTF8')),'hex')`,
          }
        : {}),
    })
    .from(content)
    .where(and(eq(content.id, contentId), sql`${editorialId} is not null`))
    .for("share")
    .limit(1);
  if (!publication) throw new NotFoundError("Publication");
  const [comment] =
    commentId !== null
      ? await tx
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
          .limit(1)
      : [];
  if (commentId !== null && !comment) {
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
        eq(reports.targetType, commentId === null ? "content" : "comment"),
        eq(reports.targetId, commentId ?? contentId),
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
        commentId === null ? "publication-report-batch" : "discussion-report-batch",
        actorId,
        contentId,
        commentId,
        publication.status,
        publication.title,
        commentId === null ? publication.digest : (comment?.digest ?? null),
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

export async function previewDiscussionBatch(
  actorId: string,
  contentId: string,
  commentId: string,
  input: BatchInput,
) {
  return db.transaction(async (tx) => {
    const plan = await targetBatchPlan(tx, actorId, contentId, commentId, input, false);
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

export async function decideDiscussionBatch(
  actorId: string,
  contentId: string,
  commentId: string,
  input: BatchInput & { previewRevision: string },
  auditIds: string[],
  currentToken: string,
) {
  return decideTargetBatch(actorId, contentId, commentId, input, auditIds, currentToken);
}

export async function previewPublicationBatch(
  actorId: string,
  contentId: string,
  input: BatchInput,
) {
  return db.transaction(async (tx) => {
    const plan = await targetBatchPlan(tx, actorId, contentId, null, input, false);
    return {
      contentId,
      commentId: null,
      publication: plan.publication,
      comment: null,
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

export async function decidePublicationBatch(
  actorId: string,
  contentId: string,
  input: BatchInput & { previewRevision: string },
  auditIds: string[],
  currentToken: string,
) {
  return decideTargetBatch(actorId, contentId, null, input, auditIds, currentToken);
}

async function decideTargetBatch(
  actorId: string,
  contentId: string,
  commentId: string | null,
  input: BatchInput & { previewRevision: string },
  auditIds: string[],
  currentToken: string,
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
    const plan = await targetBatchPlan(tx, actorId, contentId, commentId, input, true);
    if (plan.previewRevision !== input.previewRevision)
      throw new AppError("Report review changed", 409, "REPORT_BATCH_CHANGED");
    await lockInitiatingSession(tx, actorId, currentToken);
    const stored = await tx
      .update(reports)
      .set({
        status: plan.status,
        moderatorNotes: input.notes.trim(),
        resolvedAt: plan.status === "under_review" ? null : new Date(),
      })
      .where(
        and(
          eq(reports.targetType, commentId === null ? "content" : "comment"),
          eq(reports.targetId, commentId ?? contentId),
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
    // Lock the whole bounded audience before the first notice can acquire the
    // push queue gate. Report-ID order need not match preference-lock order.
    await lockNotificationPreferencesForUsers(
      tx,
      plan.rows.map((row) => row.reporterId),
    );
    for (const [index, row] of plan.rows.entries())
      await persistDecisionNotice(tx, {
        auditId: auditIds[index],
        id: row.id,
        reporterId: row.reporterId,
        status: plan.status,
      });
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

export async function decide(input: {
  id: string;
  actorId: string;
  expectedStatus: "open" | "under_review";
  action: "review" | "resolve" | "dismiss" | "remove_comment";
  notes: string;
  expectedRevision?: string;
  auditId: string;
  removalAuditId: string;
  currentToken: string;
}) {
  return db.transaction(async (tx) => {
    // Recheck the current staff role before inspecting a target; the final role lock
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
      return row;
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
            const report = await lockReport(scope.commentId);
            await lockInitiatingSession(tx, input.actorId, input.currentToken);
            // Removal also stores an author notice. Acquire both recipients
            // before that notice takes the shared push queue gate.
            await lockNotificationPreferencesForUsers(tx, [scope.authorId, report.reporterId]);
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
      await lockInitiatingSession(tx, input.actorId, input.currentToken);
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
    await persistDecisionNotice(tx, {
      auditId: input.auditId,
      id: current.id,
      reporterId: current.reporterId,
      status,
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
