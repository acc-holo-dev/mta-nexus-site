import type { NextRequest } from "next/server";
import { libraryCollectionInventoryQuery } from "../../../../../features/library/library-collection-inventory-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.inventory(
      actor,
      libraryCollectionInventoryQuery(request.nextUrl.searchParams),
    ),
  );
}
