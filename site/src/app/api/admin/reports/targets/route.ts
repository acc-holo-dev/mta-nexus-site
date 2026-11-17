import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { reportRateLimit } from "../../../../../features/community/community-report-api";
import { parseReportGroupsQuery } from "../../../../../features/community/community-report-groups-contract";
import { reportGroupsError } from "../../../../../features/community/community-report-groups-copy";
import { communityReportGroupsService } from "../../../../../lib/services/community-report-groups-service";
export function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseReportGroupsQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid groups", 400, "CHANGE_HISTORY_FILTER_INVALID");
      await reportRateLimit(actor.id, "search");
      return communityReportGroupsService.page(actor, filters);
    },
    200,
    reportGroupsError,
  );
}
