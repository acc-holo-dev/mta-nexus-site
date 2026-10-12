import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionHistoryQuery } from "../../../../../../lib/library-collection-history-query";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const report = await libraryCollectionsService.accountHistory(
      actor,
      libraryCollectionHistoryQuery(request.nextUrl.searchParams),
    );
    const json = JSON.stringify(report, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Collection history export too large", 413, "COLLECTION_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=collection-command-history.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
