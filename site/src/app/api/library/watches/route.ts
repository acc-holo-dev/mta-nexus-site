import type { NextRequest } from "next/server";
import { resourceReleaseWatchesQuery } from "../../../../features/resources/resource-release-watches-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceReleaseWatchesService } from "../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (user) => {
    const query = resourceReleaseWatchesQuery(request.nextUrl.searchParams);
    return resourceReleaseWatchesService.page(user, query.page, query.filter, query.query);
  });
}
