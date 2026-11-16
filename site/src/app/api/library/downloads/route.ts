import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceDeliveriesQuery } from "../../../../lib/resource-deliveries-query";
import { resourceDeliveriesService } from "../../../../lib/services/resource-deliveries-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceDeliveriesService.page(actor, resourceDeliveriesQuery(request.nextUrl.searchParams)),
  );
}
