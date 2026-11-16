import type { NextRequest } from "next/server";
import { libraryCollectionInventoryQuery } from "../../../../../lib/library-collection-inventory-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.inventory(
      actor,
      libraryCollectionInventoryQuery(request.nextUrl.searchParams),
    ),
  );
}
