import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceReleaseWatchHistoryQuery } from "../../../../../features/resources/resource-release-watch-history-query";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resources/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceReleaseWatchesService.history(
      actor,
      resourceReleaseWatchHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
