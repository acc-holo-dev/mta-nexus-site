import type { NextRequest } from "next/server";
import { reportId, reportRateLimit } from "../../../../../lib/community-report-api";
import { communityReportError } from "../../../../../lib/community-report-copy";
import { communityReportService } from "../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
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
