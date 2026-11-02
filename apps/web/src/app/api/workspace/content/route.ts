import { authorContentRepository } from "@nexus/db";
import { RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { authorContentService } from "../../../../lib/services/author-content-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { parseContentPage } from "../../../../lib/user-platform-contract";

export function GET(request: NextRequest) {
  return userPlatformApi(request, (user) =>
    authorContentRepository.pageByAuthor(user.id, parseContentPage(request.nextUrl.searchParams)),
  );
}
export const POST = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(
    request,
    async (user) => {
      if (!(await consumeRateLimit("contentCreation", user.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      const content = await authorContentService.create(
        await readBoundedJson(request, 128 * 1024),
        user,
      );
      return { success: true, content };
    },
    201,
  );
});
