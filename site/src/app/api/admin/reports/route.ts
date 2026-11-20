import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import {
  reportFilters,
  reportRateLimit,
} from "../../../../features/community/community-report-api";
import { communityReportError } from "../../../../features/community/community-report-copy";
import { communityReportService } from "../../../../lib/services/community/community-report-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = reportFilters(request.nextUrl.searchParams);
      await reportRateLimit(actor.id, "search");
      return communityReportService.page(actor, filters, true);
    },
    200,
    communityReportError,
  );
}
