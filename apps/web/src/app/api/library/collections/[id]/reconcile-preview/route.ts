import { AppError, LIBRARY_COLLECTION_MANIFEST_BYTES } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected reconciliation query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.reconcilePreview(
      actor,
      (await params).id,
      await readBoundedJson(request, LIBRARY_COLLECTION_MANIFEST_BYTES),
    );
  });
}
