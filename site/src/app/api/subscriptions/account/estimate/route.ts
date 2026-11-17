import type { NextRequest } from "next/server";
import { subscriptionEstimateQuery } from "../../../../../features/commerce/subscriptions-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../../lib/services/subscriptions-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.estimate(actor, subscriptionEstimateQuery(request.nextUrl.searchParams)),
  );
}
