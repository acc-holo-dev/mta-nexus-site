import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { reportId, reportRateLimit } from "../../../../../features/community/community-report-api";
import { communityReportError } from "../../../../../features/community/community-report-copy";
import { communityReportService } from "../../../../../lib/services/community/community-report-service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const id = reportId((await context.params).id);
      await reportRateLimit(actor.id, "search");
      return communityReportService.detail(actor, id);
    },
    200,
    communityReportError,
  );
}
