import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../features/resources/resource-commerce-http";
import { resourceReleaseWatchesQuery } from "../../../../features/resources/resource-release-watches-query";
import { resourceReleaseWatchesService } from "../../../../lib/services/resources/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (user) => {
    const query = resourceReleaseWatchesQuery(request.nextUrl.searchParams);
    return resourceReleaseWatchesService.page(user, query.page, query.filter, query.query);
  });
}
