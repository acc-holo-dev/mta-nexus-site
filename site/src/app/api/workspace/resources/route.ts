import type { NextRequest } from "next/server";
import { resourcePublisherQuery } from "../../../../features/resources/resource-publisher-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourcePublisherService } from "../../../../lib/services/resource-publisher-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourcePublisherService.inventory(actor, resourcePublisherQuery(request.nextUrl.searchParams)),
  );
}
