import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { parsePublicationQuery } from "../../../../lib/publication-feed-contract";
import { publicationError } from "../../../../lib/publication-feed-copy";
import { publicationFeedService } from "../../../../lib/services/publication-feed-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (user) => {
      const query = parsePublicationQuery(request.nextUrl.searchParams);
      if (!query) throw new AppError("Invalid filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", user.id)).success) throw new RateLimitExceededError();
      return publicationFeedService.page({ kind: "following", actorId: user.id }, query);
    },
    200,
    publicationError,
  );
}
