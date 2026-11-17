import type { NextRequest } from "next/server";
import { resourceReviewQuery } from "../../../features/resources/resource-review-query";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
import { resourceReviewService } from "../../../lib/services/resource-review-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = resourceReviewQuery(request.nextUrl.searchParams, true);
    return resourceReviewService.reportsPage(actor, false, query.page, query.view);
  });
}
