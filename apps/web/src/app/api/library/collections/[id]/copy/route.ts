import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected copy query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.copyPreview(actor, (await params).id);
  });
}
