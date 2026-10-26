import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { librarySelectionBatchesService as service } from "../../../../../../lib/services/library-selection-batches-service";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
export const POST = withBrowserMutation((request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected query", 400, "SELECTION_BATCH_INVALID");
    return service.command(actor, (await params).id, await readBoundedJson(request, 8192));
  });
});
