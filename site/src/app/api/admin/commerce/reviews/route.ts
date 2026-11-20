import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceReviewQuery } from "../../../../../features/resources/resource-review-query";
import { resourceReviewService } from "../../../../../lib/services/resources/resource-review-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = resourceReviewQuery(request.nextUrl.searchParams, true);
    return resourceReviewService.reportsPage(actor, true, query.page, query.view);
  });
}
