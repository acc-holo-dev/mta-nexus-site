import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { collectionReleasesQuery } from "../../../../../../lib/collection-releases-query";
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
