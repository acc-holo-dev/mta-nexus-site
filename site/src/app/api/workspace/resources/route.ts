import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { resourcePublisherQuery } from "../../../../features/resources/resource-publisher-query";
import { resourcePublisherService } from "../../../../lib/services/resource-publisher-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourcePublisherService.inventory(actor, resourcePublisherQuery(request.nextUrl.searchParams)),
  );
}
