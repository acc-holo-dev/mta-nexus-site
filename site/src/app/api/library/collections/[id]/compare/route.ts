import type { NextRequest } from "next/server";
import { libraryCollectionComparisonQuery } from "../../../../../../lib/library-collection-comparison-query";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryCollectionsService.comparison(
      actor,
      (await params).id,
      libraryCollectionComparisonQuery(request.nextUrl.searchParams),
    ),
  );
}
