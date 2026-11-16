import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { communityTopicRecoveryService } from "../../../../lib/services/community-topic-recovery-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";

export function GET(request: NextRequest) {
  return userPlatformApi(request, async (actor) => {
    const expectedActor = request.headers.get("x-nexus-actor-id");
    if (!expectedActor) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expectedActor !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
    if (!(await consumeRateLimit("resourceInspection", actor.id)).success)
      throw new RateLimitExceededError();
    const values = request.nextUrl.searchParams.getAll("slug");
    const slug = values[0] ?? "";
    if (
      values.length !== 1 ||
      !/^[a-z0-9-]{3,200}$/u.test(slug) ||
      [...request.nextUrl.searchParams.keys()].some((key) => key !== "slug")
    )
      throw new AppError("Invalid topic address", 400, "VALIDATION_FAILED");
    return { content: await communityTopicRecoveryService.findOwned(slug, actor.id) };
  });
}
