import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { collectionReleasesQuery } from "../../../../../../../lib/collection-releases-query";
import { libraryCollectionsService } from "../../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await libraryCollectionsService.releases(
      actor,
      (await params).id,
      collectionReleasesQuery(request.nextUrl.searchParams),
    );
    const json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Release export too large", 413, "COLLECTION_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=collection-releases.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
