import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { resourceReleaseWatchesQuery } from "../../../../lib/resource-release-watches-query";
import { resourceReleaseWatchesService } from "../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (user) => {
    const query = resourceReleaseWatchesQuery(request.nextUrl.searchParams);
    return resourceReleaseWatchesService.page(user, query.page, query.filter);
  });
}
