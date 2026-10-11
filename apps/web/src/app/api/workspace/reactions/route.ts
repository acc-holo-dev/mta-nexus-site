import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { parseReactionPage } from "../../../../lib/content-reaction-contract";
import { reactionError } from "../../../../lib/content-reaction-copy";
import { contentReactionService } from "../../../../lib/services/content-reaction-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseReactionPage(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid reaction page", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return contentReactionService.page(actor, filters);
    },
    200,
    reactionError,
  );
}
