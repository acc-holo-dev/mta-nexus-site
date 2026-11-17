import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { authorPublicationDeskError } from "../../../../../../features/community/author-publication-desk-copy";
import { parseAuthorPublicationHistoryQuery } from "../../../../../../lib/author-publication-desk-contract";
import { authorContentService } from "../../../../../../lib/services/author-content-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseAuthorPublicationHistoryQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid history cursor", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return authorContentService.history((await params).id, actor, filters);
    },
    200,
    authorPublicationDeskError,
  );
}
