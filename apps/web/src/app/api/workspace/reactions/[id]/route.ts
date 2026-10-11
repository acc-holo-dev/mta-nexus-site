import type { NextRequest } from "next/server";
import { z } from "zod";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { reactionError } from "../../../../../lib/content-reaction-copy";
import { contentReactionService } from "../../../../../lib/services/content-reaction-service";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
const command = z.object({}).strict();
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("contentReaction", actor.id)).success)
        throw new RateLimitExceededError();
      requireServerJsonContentType(request);
      if (!command.safeParse(await readBoundedJson(request, 4 * 1024)).success)
        throw new AppError("Invalid cleanup command", 400, "VALIDATION_ERROR");
      return contentReactionService.remove(actor, (await params).id);
    },
    200,
    reactionError,
  );
}
