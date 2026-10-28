import { AppError } from "@nexus/domain";
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
    if (request.nextUrl.searchParams.size)
      throw new AppError("Invalid plan review query", 400, "PLAN_REVIEW_INVALID");
    return planReviewsService.save(actor, await readBoundedJson(request, 4096));
  });
});
