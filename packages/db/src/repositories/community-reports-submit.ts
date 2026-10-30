import { AppError, NotFoundError } from "@nexus/domain";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, comments, content, reportNotificationDeliveries, reports } from "../schema";

export async function submit(input: {
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
      createdAt: sql`clock_timestamp()`,
    });
    const createdAt = sql`(select ${reports.createdAt} from ${reports} where ${reports.id} = ${input.id})`;
    await tx.insert(auditEvents).values({
      id: input.auditId,
      actorId: input.actorId,
      actorType: "user",
      action: "report.created",
      targetType: "report",
      targetId: input.id,
      details: { targetType: input.targetType, contentId: publication.id, type: input.type },
      createdAt,
    });
    await tx
      .insert(reportNotificationDeliveries)
      .values({ reportId: input.id, createdAt, community: true });
    return { id: input.id, created: true };
  });
}
