import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseAuthorPublicationDeskQuery } from "../../../../../lib/author-publication-desk-contract";
import { authorPublicationDeskError } from "../../../../../lib/author-publication-desk-copy";
import { authorContentService } from "../../../../../lib/services/author-content-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseAuthorPublicationDeskQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid desk filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return authorContentService.desk(actor, filters);
    },
    200,
    authorPublicationDeskError,
  );
}
