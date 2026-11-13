import type { NextRequest } from "next/server";
import { reportFilters, reportRateLimit } from "../../../../lib/community-report-api";
import { communityReportError } from "../../../../lib/community-report-copy";
import { communityReportService } from "../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
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
