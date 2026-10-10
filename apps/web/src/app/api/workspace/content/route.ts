import type { NextRequest } from "next/server";
import { authorContentRepository } from "@nexus/db";
import { consumeRateLimit } from "@nexus/security";
import { RateLimitExceededError } from "@nexus/domain";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { parseContentPage } from "../../../../lib/user-platform-contract";
import { authorContentService } from "../../../../lib/services/author-content-service";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";

export function GET(request: NextRequest) {
  return userPlatformApi(request, (user) =>
    authorContentRepository.pageByAuthor(user.id, parseContentPage(request.nextUrl.searchParams)),
  );
}
export function POST(request: NextRequest) {
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
}
