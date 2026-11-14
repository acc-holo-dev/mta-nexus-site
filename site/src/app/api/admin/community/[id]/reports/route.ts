import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { reportFilters, reportRateLimit } from "../../../../../../lib/community-report-api";
import { communityReportError } from "../../../../../../lib/community-report-copy";
import { publicationReportsPageSchema } from "../../../../../../lib/community-report-groups-contract";
import { communityReportService } from "../../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = reportFilters(request.nextUrl.searchParams);
      if (filters.target && filters.target !== "content")
        throw new AppError("Invalid target", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "search");
      const id = (await params).id,
        result = publicationReportsPageSchema.safeParse(
          await communityReportService.publicationReports(actor, id, filters),
        );
      if (
        !result.success ||
        result.data.publication.id !== id ||
        result.data.page !== filters.page ||
        result.data.view !== filters.view
      )
        throw new AppError("Report context unavailable", 503, "INTERNAL_ERROR");
      return result.data;
    },
    200,
    communityReportError,
  );
}
