import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { discussionWorkspaceService } from "../../../../lib/services/discussion-workspace-service";
import { ownDiscussionError } from "../../../../lib/discussion-workspace-copy";
import { parseOwnDiscussionQuery } from "../../../../lib/discussion-workspace-contract";
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
