import type { NextRequest } from "next/server";
import { libraryReleaseHistoryQuery } from "../../../../../lib/library-release-history-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryReleaseService } from "../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryReleaseService.history(actor, libraryReleaseHistoryQuery(request.nextUrl.searchParams)),
  );
}
