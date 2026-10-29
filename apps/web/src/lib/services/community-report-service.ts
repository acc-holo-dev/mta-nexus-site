import { communityReportsRepository } from "@nexus/db";
import type { User } from "@nexus/domain";
import { AppError, ForbiddenError, NotFoundError } from "@nexus/domain";
import { can, generateId } from "@nexus/security";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import type {
  CommunityReportQuery,
  communityReportCreateSchema,
  communityReportDecisionSchema,
} from "../community-report-contract";
import { reportBatchCommandInput, reportBatchPreviewInput } from "../report-batch-contract";

function summary(
  row: Awaited<ReturnType<typeof communityReportsRepository.page>>["items"][number],
) {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    type: row.type,
    reason: row.reason,
    evidenceUrls: row.evidenceUrls.slice(0, 5).flatMap((url) => {
      const safe = safeExternalWebUrl(url);
      return safe ? [safe] : [];
    }),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
class CommunityReportService {
  async publicationReports(actor: User, contentId: string, filters: CommunityReportQuery) {
    this.batchScope(actor, contentId, contentId);
    const result = await communityReportsRepository.publicationReports(actor.id, contentId, {
      view: filters.view,
      page: filters.page,
      type: filters.type,
      query: filters.query ?? "",
    });
    return {
      ...result,
      items: result.items.map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
        resolvedAt: item.resolvedAt?.toISOString() ?? null,
      })),
    };
  }
  async previewPublicationBatch(actor: User, contentId: string, input: unknown) {
    this.batchScope(actor, contentId, contentId);
    const parsed = reportBatchPreviewInput.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    const result = await communityReportsRepository.previewPublicationBatch(
      actor.id,
      contentId,
      parsed.data,
    );
    if (
      typeof result.publication.text !== "string" ||
      typeof result.publication.truncated !== "boolean"
    )
      throw new AppError("Publication review unavailable", 503, "INTERNAL_ERROR");
    return {
      ...result,
      publication: {
        id: result.publication.id,
        title: result.publication.title,
        status: result.publication.status,
        text: result.publication.text,
        truncated: result.publication.truncated,
      },
      items: result.items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
    };
  }
  async decidePublicationBatch(
    actor: User,
    contentId: string,
    input: unknown,
    currentToken: string,
  ) {
    this.batchScope(actor, contentId, contentId);
    const parsed = reportBatchCommandInput.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    return communityReportsRepository.decidePublicationBatch(
      actor.id,
      contentId,
      parsed.data,
      parsed.data.items.map(() => generateId("aud")),
      currentToken,
    );
  }

  private batchScope(actor: User, contentId: string, commentId: string) {
    this.scope(actor, true);
    if ([contentId, commentId].some((id) => !/^[a-zA-Z0-9_-]{1,128}$/u.test(id)))
      throw new NotFoundError("Discussion");
  }
  async previewDiscussionBatch(actor: User, contentId: string, commentId: string, input: unknown) {
    this.batchScope(actor, contentId, commentId);
    const parsed = reportBatchPreviewInput.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    const result = await communityReportsRepository.previewDiscussionBatch(
      actor.id,
      contentId,
      commentId,
      parsed.data,
    );
    return {
      contentId: result.contentId,
      commentId: result.commentId,
      action: result.action,
      notes: result.notes,
      previewRevision: result.previewRevision,
      publication: {
        id: result.publication.id,
        title: result.publication.title,
        status: result.publication.status,
      },
      comment: result.comment
        ? {
            id: result.comment.id,
            text: result.comment.text,
            truncated: result.comment.truncated,
            revision: result.comment.revision,
          }
        : null,
      items: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        reason: item.reason,
        before: item.before,
        after: item.after,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  }
  async decideDiscussionBatch(
    actor: User,
    contentId: string,
    commentId: string,
    input: unknown,
    currentToken: string,
  ) {
    this.batchScope(actor, contentId, commentId);
    const parsed = reportBatchCommandInput.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid report batch", 400, "REPORT_BATCH_INVALID");
    return communityReportsRepository.decideDiscussionBatch(
      actor.id,
      contentId,
      commentId,
      parsed.data,
      parsed.data.items.map(() => generateId("aud")),
      currentToken,
    );
  }

  private scope(actor: User, staff: boolean) {
    if (staff && !can(actor, "admin.moderation")) throw new ForbiddenError();
    return { actorId: actor.id, staff };
  }
  async submit(actor: User, input: z.infer<typeof communityReportCreateSchema>) {
    const result = await communityReportsRepository.submit({
      ...input,
      actorId: actor.id,
      id: generateId("rpt"),
      auditId: generateId("aud"),
    });
    return { ...result, targetType: input.targetType, targetId: input.targetId };
  }
  async page(actor: User, filters: CommunityReportQuery, staff = false) {
    const result = await communityReportsRepository.page(this.scope(actor, staff), filters);
    return {
      items: result.items.map(summary),
      hasMore: result.hasMore,
      page: filters.page,
      view: filters.view,
    };
  }
  async detail(actor: User, id: string, staff = false) {
    const row = await communityReportsRepository.detail(this.scope(actor, staff), id);
    return {
      ...summary(row),
      target: row.target
        ? {
            kind: row.target.kind,
            title: row.target.title,
            text: Array.from(row.target.text).slice(0, 5000).join(""),
            truncated: row.target.truncated,
            author: row.target.author,
            status: row.target.status,
            href:
              row.target.status === "published"
                ? `/articles/${encodeURIComponent(row.target.slug)}${row.target.kind === "comment" ? `#comment-${encodeURIComponent(row.target.id)}` : ""}`
                : null,
            revision: staff ? row.target.revision : null,
          }
        : null,
      ...(staff
        ? {
            moderatorNotes: row.moderatorNotes ?? null,
            reporterId: row.reporterId,
            moderationHref: row.moderationContentId
              ? `/admin/community/${encodeURIComponent(row.moderationContentId)}${row.targetType === "comment" ? `/discussion/${encodeURIComponent(row.targetId)}` : ""}`
              : null,
          }
        : {}),
    };
  }
  async decide(
    actor: User,
    id: string,
    input: z.infer<typeof communityReportDecisionSchema>,
    currentToken: string,
  ) {
    this.scope(actor, true);
    return communityReportsRepository.decide({
      ...input,
      id,
      actorId: actor.id,
      auditId: generateId("aud"),
      removalAuditId: generateId("aud"),
      currentToken,
    });
  }
}
export const communityReportService = new CommunityReportService();
