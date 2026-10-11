import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryReleaseHistoryQuery } from "../../../../../lib/library-release-history-query";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryReleaseService.history(actor, libraryReleaseHistoryQuery(request.nextUrl.searchParams)),
  );
}
