import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "./bounded-json";
import { parseModerationDetailQuery } from "./community-moderation-contract";
import { reportRateLimit } from "./community-report-api";
import { parseModeratedDiscussionQuery } from "./moderated-discussion-contract";
import { moderatedDiscussionError } from "./moderated-discussion-copy";
import { communityModerationService } from "./services/community-moderation-service";
import { userPlatformApi } from "./user-platform-api";
export function getModeratedDiscussion(
  request: NextRequest,
  params: Promise<{ id: string; commentId?: string }>,
) {
  return userPlatformApi(
    request,
    async (actor) => {
      const scope = await params;
      const filters = scope.commentId
        ? parseModerationDetailQuery(request.nextUrl.searchParams)
        : parseModeratedDiscussionQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid discussion filters", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "search");
      if (scope.commentId)
        return communityModerationService.discussionDetail(
          actor,
          scope.id,
          scope.commentId,
          filters.cursor,
        );
      return communityModerationService.discussion(
        actor,
        scope.id,
        filters as NonNullable<ReturnType<typeof parseModeratedDiscussionQuery>>,
      );
    },
    200,
    moderatedDiscussionError,
  );
}
export function removeModeratedDiscussion(
  request: NextRequest,
  params: Promise<{ id: string; commentId: string }>,
) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected command filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await reportRateLimit(actor.id, "moderationAction");
      const scope = await params;
      return communityModerationService.removeDiscussion(
        actor,
        scope.id,
        scope.commentId,
        await readBoundedJson(request, 8192),
      );
    },
    200,
    moderatedDiscussionError,
  );
}
