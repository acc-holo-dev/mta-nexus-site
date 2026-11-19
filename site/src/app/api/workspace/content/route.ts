import { RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { parseContentPage } from "../../../../features/community/user-platform-contract";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { authorContentService } from "../../../../lib/services/organizations/author-content-service";

export function GET(request: NextRequest) {
  return userPlatformApi(request, (user) =>
    authorContentService.pageByAuthor(user.id, parseContentPage(request.nextUrl.searchParams)),
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
        undefined,
        undefined,
        request.cookies.get("nexus_session")?.value,
      );
      return { success: true, content };
    },
    201,
  );
});
