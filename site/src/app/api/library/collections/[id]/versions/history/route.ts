import type { NextRequest } from "next/server";
import { collectionsQuery } from "../../../../../../../features/library/library-collections-query";
import { resourceCommerceRequest } from "../../../../../../../features/resources/resource-commerce-http";
import { librarySelectionBatchesService as service } from "../../../../../../../lib/services/library/library-selection-batches-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    service.history(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "history").page,
    ),
  );
}
