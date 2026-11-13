import type { NextRequest } from "next/server";
import { libraryCollectionHistoryQuery } from "../../../../../lib/library-collection-history-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.accountHistory(
      actor,
      libraryCollectionHistoryQuery(request.nextUrl.searchParams),
    ),
  );
}
