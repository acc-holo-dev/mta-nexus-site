import type { NextRequest } from "next/server";
import { collectionsQuery } from "../../../../../../../lib/library-collections-query";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { librarySelectionBatchesService as service } from "../../../../../../../lib/services/library-selection-batches-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    service.history(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "history").page,
    ),
  );
}
