import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { reportRateLimit } from "../../../../../lib/community-report-api";
import { parseReportGroupsQuery } from "../../../../../lib/community-report-groups-contract";
import { reportGroupsError } from "../../../../../lib/community-report-groups-copy";
import { communityReportGroupsService } from "../../../../../lib/services/community-report-groups-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
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
