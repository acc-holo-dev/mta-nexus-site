import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../../lib/resource-commerce-http";
import { collectionsQuery } from "../../../../../../../../lib/library-collections-query";
import { librarySelectionBatchesService } from "../../../../../../../../lib/services/library-selection-batches-service";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const result = await librarySelectionBatchesService.history(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "history").page,
    );
    const json = JSON.stringify(result, null, 2);
    if (Buffer.byteLength(json) > 512 * 1024)
      throw new AppError("Report exceeds export limit", 413, "SELECTION_BATCH_EXPORT_TOO_LARGE");
    return new Response(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": "attachment; filename=version-selection-history.json",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
