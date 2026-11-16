import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../../lib/services/subscriptions-service";
import { subscriptionEstimateQuery } from "../../../../../lib/subscriptions-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.estimate(actor, subscriptionEstimateQuery(request.nextUrl.searchParams)),
  );
}
