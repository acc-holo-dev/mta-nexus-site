import { AppError, LIBRARY_COLLECTION_MANIFEST_BYTES } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected export query", 400, "COLLECTION_INVALID");
    const json = JSON.stringify(
      await libraryCollectionsService.exportManifest(actor, (await params).id),
      null,
      2,
    );
    if (Buffer.byteLength(json) > LIBRARY_COLLECTION_MANIFEST_BYTES)
      throw new AppError("Collection export too large", 413, "COLLECTION_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=resource-collection.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
