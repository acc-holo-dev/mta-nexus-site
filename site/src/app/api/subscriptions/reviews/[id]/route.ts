import type { NextRequest } from "next/server";
import { planReviewId, planReviewsQuery } from "../../../../../lib/plan-reviews-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { planReviewsService } from "../../../../../lib/services/plan-reviews-service";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = planReviewsQuery(request.nextUrl.searchParams, true);
    return planReviewsService.detail(
      actor,
      planReviewId((await context.params).id),
      query.organizationId,
    );
  });
}
