import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../../../lib/services/library-collections-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected receipt query", 400, "COLLECTION_INVALID");
    const json = JSON.stringify(
      await libraryCollectionsService.receiptDetail(actor, (await params).id),
      null,
      2,
    );
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Receipt export too large", 413, "COLLECTION_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=collection-receipt.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
