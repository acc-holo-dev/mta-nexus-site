import { communityReportsRepository } from "@nexus/db";
import {
  AppError,
  type ChangeHistoryFilters,
  ForbiddenError,
  type ReportHistoryGroup,
  type User,
} from "@nexus/domain";
import { can } from "@nexus/security";
import { reportId } from "../community-report-api";
import {
  parseReportHistoryQuery,
  reportHistoryPageSchema,
} from "../community-report-history-contract";
import { encodeChangeHistoryCursor } from "../private-change-history-query";
export const communityReportHistoryService = {
  async page(
    actor: User,
    id: string,
    filters: ChangeHistoryFilters<ReportHistoryGroup>,
    staff = false,
  ) {
    reportId(id);
    if (staff && !can(actor, "admin.moderation")) throw new ForbiddenError();
    const result = await communityReportsRepository.history(
      { actorId: actor.id, staff },
      id,
      filters,
    );
    const cursor = result.nextCursor
      ? {
          version: result.nextCursor.version,
          context: result.nextCursor.context,
          until: result.nextCursor.until,
          id: result.nextCursor.id,
        }
      : null;
    const encoded = cursor ? encodeChangeHistoryCursor(cursor) : null;
    if (
      cursor &&
      (!encoded ||
        !parseReportHistoryQuery(
          new URLSearchParams({
            period: filters.period,
            group: filters.group,
            until: result.until,
            cursor: encoded,
          }),
        )?.cursor ||
        cursor.id !== result.items.at(-1)?.id)
    )
      throw new AppError("Report history cursor unavailable", 503, "INTERNAL_ERROR");
    const parsed = reportHistoryPageSchema.safeParse({
      ...result,
      nextCursor: encoded,
    });
    if (
      !parsed.success ||
      parsed.data.report.id !== id ||
      parsed.data.audience !== (staff ? "staff" : "requester") ||
      parsed.data.period !== filters.period ||
      parsed.data.group !== filters.group ||
      ((filters.cursor?.until ?? filters.until) !== undefined &&
        parsed.data.until !== (filters.cursor?.until ?? filters.until))
    )
      throw new AppError("Report history unavailable", 503, "INTERNAL_ERROR");
    return parsed.data;
  },
};
