import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { authorPublicationDeskError } from "../../../../../../lib/author-publication-desk-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../../lib/bounded-json";
import { authorContentService } from "../../../../../../lib/services/author-content-service";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export const POST = withBrowserMutation(async (
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if ([...request.nextUrl.searchParams].length)
        throw new AppError("Invalid restore parameters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("contentEditing", actor.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      return authorContentService.restore(
        (await params).id,
        await readBoundedJson(request, 1024),
        actor,
      );
    },
    200,
    authorPublicationDeskError,
  );
});
