import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { moderationError } from "../../../../features/community/community-moderation-copy";
import { reportRateLimit } from "../../../../features/community/community-report-api";
import { parseModerationQuery } from "../../../../features/moderation/community-moderation-contract";
import { communityModerationService } from "../../../../lib/services/community-moderation-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseModerationQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid moderation filters", 400, "VALIDATION_ERROR");
      await reportRateLimit(actor.id, "search");
      return communityModerationService.page(actor, filters);
    },
    200,
    moderationError,
  );
}
