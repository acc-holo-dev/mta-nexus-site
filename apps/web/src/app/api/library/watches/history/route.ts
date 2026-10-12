import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceReleaseWatchHistoryQuery } from "../../../../../lib/resource-release-watch-history-query";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceReleaseWatchesService.history(
      actor,
      resourceReleaseWatchHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
