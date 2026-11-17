import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { parseOwnDiscussionQuery } from "../../../../features/community/discussion-workspace-contract";
import { ownDiscussionError } from "../../../../features/community/discussion-workspace-copy";
import { discussionWorkspaceService } from "../../../../lib/services/discussion-workspace-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseOwnDiscussionQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return discussionWorkspaceService.page(actor, filters);
    },
    200,
    ownDiscussionError,
  );
}
