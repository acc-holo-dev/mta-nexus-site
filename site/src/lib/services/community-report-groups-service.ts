import { communityReportsRepository } from "@nexus/db";
import {
  AppError,
  type CommunityReportGroupFilters,
  ForbiddenError,
  type User,
} from "@nexus/domain";
import { can } from "@nexus/security";
import {
  parseReportGroupsQuery,
  reportGroupsPageSchema,
} from "../community-report-groups-contract";
import { encodeChangeHistoryCursor } from "../private-change-history-query";
export const communityReportGroupsService = {
  async page(actor: User, filters: CommunityReportGroupFilters) {
    if (!can(actor, "admin.moderation")) throw new ForbiddenError();
    const result = await communityReportsRepository.groups(actor.id, filters),
      cursor = result.nextCursor
        ? {
            version: result.nextCursor.version,
            context: result.nextCursor.context,
            until: result.nextCursor.until,
            id: result.nextCursor.id,
          }
        : null,
      encoded = cursor ? encodeChangeHistoryCursor(cursor) : null;
    if (
      cursor &&
      (!encoded ||
        !parseReportGroupsQuery(
          new URLSearchParams({
            period: filters.period,
            view: filters.view,
            ...(filters.target ? { target: filters.target } : {}),
            ...(filters.type ? { type: filters.type } : {}),
            q: filters.query,
            until: result.until,
            cursor: encoded,
          }),
        )?.cursor ||
        cursor.id !== result.items.at(-1)?.anchorId)
    )
      throw new AppError("Group cursor unavailable", 503, "INTERNAL_ERROR");
    const value = {
      period: result.period,
      view: result.view,
      query: result.query,
      target: result.target,
      type: result.type,
      until: result.until,
      items: result.items.map((item) => ({
        targetType: item.targetType,
        targetId: item.targetId,
        firstAt: item.firstAt,
        lastAt: item.lastAt,
        open: item.open,
        review: item.review,
        resolved: item.resolved,
        dismissed: item.dismissed,
        reportHref: `/admin/reports/${encodeURIComponent(item.anchorId)}`,
        target: item.target,
      })),
      hasMore: result.hasMore,
      nextCursor: encoded,
    };
    const parsed = reportGroupsPageSchema.safeParse(value);
    if (
      !parsed.success ||
      parsed.data.period !== filters.period ||
      parsed.data.view !== filters.view ||
      parsed.data.query !== filters.query ||
      parsed.data.target !== (filters.target ?? null) ||
      parsed.data.type !== (filters.type ?? null) ||
      ((filters.cursor?.until ?? filters.until) !== undefined &&
        parsed.data.until !== (filters.cursor?.until ?? filters.until))
    )
      throw new AppError("Report groups unavailable", 503, "INTERNAL_ERROR");
    return parsed.data;
  },
};
