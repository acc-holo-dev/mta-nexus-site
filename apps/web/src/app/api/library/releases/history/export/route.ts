import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryReleaseHistoryQuery } from "../../../../../../lib/library-release-history-query";
import { libraryReleaseService } from "../../../../../../lib/services/resource-release-control-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await libraryReleaseService.history(
      actor,
      libraryReleaseHistoryQuery(request.nextUrl.searchParams),
    );
    const json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("History export too large", 413, "LIBRARY_HISTORY_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=version-selection-history.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
