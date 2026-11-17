import type { NextRequest } from "next/server";
import { subscriptionsQuery } from "../../../../../features/commerce/subscriptions-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { subscriptionsService } from "../../../../../lib/services/commerce/subscriptions-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.history(
      actor,
      subscriptionsQuery(request.nextUrl.searchParams, "history"),
    ),
  );
}
