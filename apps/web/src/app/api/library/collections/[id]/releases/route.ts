import type { NextRequest } from "next/server";
import { collectionReleasesQuery } from "../../../../../../lib/collection-releases-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryCollectionsService.releases(
      actor,
      (await params).id,
      collectionReleasesQuery(request.nextUrl.searchParams),
    ),
  );
}
