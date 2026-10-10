import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import {
  communityReportError,
  communityReportMutationError,
} from "../../../../lib/community-report-copy";
import { reportFilters, reportRateLimit } from "../../../../lib/community-report-api";
import { communityReportCreateSchema } from "../../../../lib/community-report-contract";
import { requireServerJsonContentType, readBoundedJson } from "../../../../lib/bounded-json";
import { AppError } from "@nexus/domain";
import { communityReportService } from "../../../../lib/services/community-report-service";
import { queueCommunityReportNotice } from "../../../../lib/services/community-report-notifications";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = reportFilters(request.nextUrl.searchParams);
      await reportRateLimit(actor.id, "search");
      return communityReportService.page(actor, filters);
    },
    200,
    communityReportError,
  );
}
export async function POST(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      requireServerJsonContentType(request);
      const parsed = communityReportCreateSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid report", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "report");
      const result = await communityReportService.submit(actor, parsed.data);
      // An idempotent duplicate is a confirmed result, not a second notification.
      if (result.created) queueCommunityReportNotice(result);
      return result;
    },
    200,
    communityReportMutationError,
  );
}
