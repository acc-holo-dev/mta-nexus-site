import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceReleaseWatchHistoryQuery } from "../../../../../../lib/resource-release-watch-history-query";
import { resourceReleaseWatchesService } from "../../../../../../lib/services/resource-release-watches-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await resourceReleaseWatchesService.history(
      actor,
      resourceReleaseWatchHistoryQuery(request.nextUrl.searchParams),
    );
    const json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError(
        "Watch history export too large",
        413,
        "RELEASE_WATCH_HISTORY_EXPORT_TOO_LARGE",
      );
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=release-watch-history.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
