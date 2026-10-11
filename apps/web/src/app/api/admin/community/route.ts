import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { parseModerationQuery } from "../../../../lib/community-moderation-contract";
import { moderationError } from "../../../../lib/community-moderation-copy";
import { reportRateLimit } from "../../../../lib/community-report-api";
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
