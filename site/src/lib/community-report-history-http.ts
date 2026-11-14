import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { reportId, reportRateLimit } from "./community-report-api";
import { parseReportHistoryQuery } from "./community-report-history-contract";
import { reportHistoryCopy, reportHistoryError } from "./community-report-history-copy";
import { resolveLocale } from "./i18n";
import { privateChangeHistoryDownload } from "./private-change-history-download";
import { communityReportHistoryService } from "./services/community-report-history-service";
import { userPlatformApi } from "./user-platform-api";
export async function reportHistoryRead(
  request: NextRequest,
  params: Promise<{ id: string }>,
  staff: boolean,
) {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = reportId((await params).id),
        filters = parseReportHistoryQuery(request.nextUrl.searchParams);
      if (!filters)
        throw new AppError("Invalid report history filters", 400, "CHANGE_HISTORY_FILTER_INVALID");
      await reportRateLimit(actor.id, "search");
      return communityReportHistoryService.page(actor, id, filters, staff);
    },
    200,
    reportHistoryError,
  );
}
export async function reportHistoryExport(
  request: NextRequest,
  params: Promise<{ id: string }>,
  staff: boolean,
) {
  return privateChangeHistoryDownload(
    await reportHistoryRead(request, params, staff),
    "report-history.json",
    reportHistoryCopy(resolveLocale(request.cookies.get("nexus_locale")?.value)).unavailable,
  );
}
