import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { planReviewsQuery } from "../../../../lib/plan-reviews-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { planReviewsService } from "../../../../lib/services/plan-reviews-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    planReviewsService.page(actor, planReviewsQuery(request.nextUrl.searchParams)),
  );
}
export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const currentToken = request.cookies.get("nexus_session")?.value;
    if (!currentToken) throw new UnauthorizedError();
    const expectedActor = request.headers.get("x-nexus-actor-id");
    if (!expectedActor) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
    if (expectedActor !== actor.id) throw new AppError("Account changed", 409, "ACTOR_CHANGED");
    if (request.nextUrl.searchParams.size)
      throw new AppError("Invalid plan review query", 400, "PLAN_REVIEW_INVALID");
    return planReviewsService.save(actor, await readBoundedJson(request, 4096), currentToken);
  });
});
