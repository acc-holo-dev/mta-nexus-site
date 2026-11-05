import { AppError, RateLimitExceededError, UnauthorizedError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { reactionError } from "../../../../../lib/content-reaction-copy";
import { contentReactionService } from "../../../../../lib/services/content-reaction-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";

const command = z.object({}).strict();
export const DELETE = withBrowserMutation(
  async (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return userPlatformApi(
      request,
      async (actor) => {
        const token = request.cookies.get("nexus_session")?.value;
        if (!token) throw new UnauthorizedError();
        const expected = request.headers.get("x-nexus-actor-id");
        if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
        if (expected !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
        if (request.nextUrl.searchParams.size)
          throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
        if (!(await consumeRateLimit("contentReaction", actor.id)).success)
          throw new RateLimitExceededError();
        requireServerJsonContentType(request);
        if (!command.safeParse(await readBoundedJson(request, 4 * 1024)).success)
          throw new AppError("Invalid cleanup command", 400, "VALIDATION_ERROR");
        return {
          ...(await contentReactionService.remove(actor, (await params).id, token)),
          actorId: actor.id,
        };
      },
      200,
      reactionError,
    );
  },
);
