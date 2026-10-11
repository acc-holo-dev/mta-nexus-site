import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  readBoundedJson,
  requireServerJsonContentType,
} from "../../../../../../../../../../lib/bounded-json";
import { reportRateLimit } from "../../../../../../../../../../lib/community-report-api";
import { reportBatchError } from "../../../../../../../../../../lib/report-batch-copy";
import { communityReportService } from "../../../../../../../../../../lib/services/community-report-service";
import { userPlatformApi } from "../../../../../../../../../../lib/user-platform-api";
export function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected batch filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await reportRateLimit(actor.id, "moderationAction");
      const scope = await params;
      return communityReportService.previewDiscussionBatch(
        actor,
        scope.id,
        scope.commentId,
        await readBoundedJson(request, 8192),
      );
    },
    200,
    reportBatchError,
  );
}
