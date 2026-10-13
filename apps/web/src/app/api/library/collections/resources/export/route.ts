import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { libraryCollectionInventoryQuery } from "../../../../../../lib/library-collection-inventory-query";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const json = JSON.stringify(
      await libraryCollectionsService.inventory(
        actor,
        libraryCollectionInventoryQuery(request.nextUrl.searchParams),
      ),
      null,
      2,
    );
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Inventory export too large", 413, "COLLECTION_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=collection-resources.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
