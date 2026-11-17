import type { NextRequest } from "next/server";
import { resourceDeliveriesQuery } from "../../../../features/resources/resource-deliveries-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceDeliveriesService } from "../../../../lib/services/resource-deliveries-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceDeliveriesService.page(actor, resourceDeliveriesQuery(request.nextUrl.searchParams)),
  );
}
