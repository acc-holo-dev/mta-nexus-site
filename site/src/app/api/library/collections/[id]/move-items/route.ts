import type { NextRequest } from "next/server";
import { collectionsQuery } from "../../../../../../lib/library-collections-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryCollectionsService.copyItemsPage(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "detail"),
    ),
  );
}
