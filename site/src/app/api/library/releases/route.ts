import type { NextRequest } from "next/server";
import { libraryReleaseQuery } from "../../../../features/resources/resource-release-control-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { libraryReleaseService } from "../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = libraryReleaseQuery(request.nextUrl.searchParams);
    return libraryReleaseService.page(actor, query.page, query.filter);
  });
}
