import type { NextRequest } from "next/server";
import { collectionsQuery } from "../../../../../../features/library/library-collections-query";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryCollectionsService.detail(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "detail"),
      true,
    ),
  );
}
