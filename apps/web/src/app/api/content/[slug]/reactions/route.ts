import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { publicPlatformApi } from "../../../../../lib/public-platform-api";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { contentReactionService } from "../../../../../lib/services/content-reaction-service";
import { authService } from "../../../../../lib/services/auth-service";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import { reactionCommandSchema } from "../../../../../lib/content-reaction-contract";
import { reactionError } from "../../../../../lib/content-reaction-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
const validQuery = (request: NextRequest) => {
  if (request.nextUrl.searchParams.size)
    throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
};
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  return publicPlatformApi(
    request,
    async () => {
      validQuery(request);
      if (!(await consumeRateLimit("search", getTrustedRequestIp(request))).success)
        throw new RateLimitExceededError();
      const actor = await authService.getSession(request.cookies.get("nexus_session")?.value);
      return contentReactionService.state((await params).slug, actor?.id);
    },
    reactionError,
    true,
  );
}
export const PUT = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ slug: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        validQuery(request);
        if (!(await consumeRateLimit("contentReaction", actor.id)).success)
          throw new RateLimitExceededError();
        requireServerJsonContentType(request);
        const parsed = reactionCommandSchema.safeParse(await readBoundedJson(request, 4 * 1024));
        if (!parsed.success) throw new AppError("Invalid reaction", 400, "VALIDATION_ERROR");
        return contentReactionService.set(actor, (await params).slug, parsed.data.reaction);
      },
      200,
      reactionError,
    );
  },
);
