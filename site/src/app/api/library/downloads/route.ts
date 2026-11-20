import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { resourceDeliveriesQuery } from "../../../../features/resources/resource-deliveries-query";
import { resourceDeliveriesService } from "../../../../lib/services/commerce/resource-deliveries-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceDeliveriesService.page(actor, resourceDeliveriesQuery(request.nextUrl.searchParams)),
  );
}
