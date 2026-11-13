import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../../lib/services/subscriptions-service";
import { subscriptionsQuery } from "../../../../../lib/subscriptions-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.history(
      actor,
      subscriptionsQuery(request.nextUrl.searchParams, "history"),
    ),
  );
}
