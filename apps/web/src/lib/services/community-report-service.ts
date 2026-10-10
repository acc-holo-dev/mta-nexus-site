import { communityReportsRepository } from "@nexus/db";
import { can, generateId } from "@nexus/security";
import { ForbiddenError } from "@nexus/domain";
import type { User } from "@nexus/domain";
import { safeExternalWebUrl } from "@nexus/validation";
import type { z } from "zod";
import type {
  CommunityReportQuery,
  communityReportCreateSchema,
  communityReportDecisionSchema,
} from "../community-report-contract";

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
            text: row.target.text.slice(0, 5000),
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
      ...(staff ? { moderatorNotes: row.moderatorNotes ?? null, reporterId: row.reporterId } : {}),
    };
  }
  async decide(actor: User, id: string, input: z.infer<typeof communityReportDecisionSchema>) {
    this.scope(actor, true);
    return communityReportsRepository.decide({
      ...input,
      id,
      actorId: actor.id,
      auditId: generateId("aud"),
      removalAuditId: generateId("aud"),
    });
  }
}
export const communityReportService = new CommunityReportService();
