import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { reactionCommandSchema } from "../../../../../lib/content-reaction-contract";
import { reactionError } from "../../../../../lib/content-reaction-copy";
import { publicPlatformApi } from "../../../../../lib/public-platform-api";
import { getTrustedRequestIp } from "../../../../../lib/request-client-ip";
import { authService } from "../../../../../lib/services/auth-service";
import { contentReactionService } from "../../../../../lib/services/content-reaction-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";

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
        const token = request.cookies.get("nexus_session")?.value;
        if (!token) throw new UnauthorizedError();
        const expected = request.headers.get("x-nexus-actor-id");
        if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
        if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
        validQuery(request);
        if (!(await consumeRateLimit("contentReaction", actor.id)).success)
          throw new RateLimitExceededError();
        requireServerJsonContentType(request);
        const parsed = reactionCommandSchema.safeParse(await readBoundedJson(request, 4 * 1024));
        if (!parsed.success) throw new AppError("Invalid reaction", 400, "VALIDATION_ERROR");
        return {
          ...(await contentReactionService.set(
            actor,
            (
              await params
            ).slug,
            parsed.data.reaction,
            token,
          )),
          actorId: actor.id,
        };
      },
      200,
      reactionError,
    );
  },
);
