import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { reportRateLimit } from "../../../../../../../../lib/community-report-api";
import { parseDiscussionReportsQuery } from "../../../../../../../../lib/discussion-reports-contract";
import { moderatedDiscussionError } from "../../../../../../../../lib/moderated-discussion-copy";
import { communityModerationService } from "../../../../../../../../lib/services/community-moderation-service";
import { userPlatformApi } from "../../../../../../../../lib/user-platform-api";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> },
) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseDiscussionReportsQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid reports filters", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "search");
      const scope = await params;
      return communityModerationService.discussionReports(
        actor,
        scope.id,
        scope.commentId,
        filters,
      );
    },
    200,
    moderatedDiscussionError,
  );
}
