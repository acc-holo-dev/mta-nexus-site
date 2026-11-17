import type { NextRequest } from "next/server";
import { resourceReleaseWatchHistoryQuery } from "../../../../../features/resources/resource-release-watch-history-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceReleaseWatchesService.history(
      actor,
      resourceReleaseWatchHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
