import type { NextRequest } from "next/server";
import { libraryReleaseHistoryQuery } from "../../../../../features/library/library-release-history-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryReleaseService.history(actor, libraryReleaseHistoryQuery(request.nextUrl.searchParams)),
  );
}
