import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { subscriptionsService } from "../../../../lib/services/subscriptions-service";
import { subscriptionsQuery } from "../../../../lib/subscriptions-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) =>
    subscriptionsService.dashboard(
      actor,
      subscriptionsQuery(request.nextUrl.searchParams).organizationId,
    ),
  );
}
export function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    subscriptionsQuery(request.nextUrl.searchParams, "empty");
    return subscriptionsService.command(actor, await readBoundedJson(request, 4096));
  });
}
