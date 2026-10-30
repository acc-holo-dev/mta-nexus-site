import { createHash } from "node:crypto";
import { AppError } from "@nexus/domain";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { db } from "../client";
import { comments, content, users } from "../schema";
import type { Session, Status } from "./community-reports-types";
import { moderationDiscussionRevision } from "./discussion-management";
import { notificationRepository } from "./notifications";
import { editorialId } from "./private-community-report-scope";

export async function targetPreview(
  tx: Session,
  targetType: string,
  targetId: string,
  staff: boolean,
) {
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

export function decisionStatus(action: string): Exclude<Status, "open"> {
  return action === "review" ? "under_review" : action === "dismiss" ? "dismissed" : "resolved";
}

export function assertDecisionState(status: string, expected: string, action: string) {
  if (
    !["open", "under_review"].includes(status) ||
    status !== expected ||
    (action === "review" && status !== "open")
  )
    throw new AppError("Report changed", 409, "REPORT_STATE_CHANGED");
}

export async function persistDecisionNotice(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: { auditId: string; id: string; reporterId: string; status: Status },
) {
  const result = await notificationRepository.createWithPushOutboxWithin(
    tx,
    {
      id: `ntf_report_${createHash("sha256")
        .update(JSON.stringify([input.auditId, input.reporterId]))
        .digest("hex")}`,
      recipientId: input.reporterId,
      title: "Community report status",
      message: `Report status: ${input.status}.`,
      link: `/workspace/reports/${encodeURIComponent(input.id)}`,
      type: "security",
      category: "security",
    },
    true,
  );
  if (
    result.notification &&
    (result.pushQueueState === "saturated" || result.pushQueueState === "error")
  )
    console.warn(
      JSON.stringify({
        event: "notification.push_outbox_degraded",
        producer: "community_report",
        reason: result.pushQueueState,
      }),
    );
}
