import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import { librarySelectionBatchesService as service } from "../../../../../../../lib/services/library/library-selection-batches-service";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected query", 400, "SELECTION_BATCH_INVALID");
      return service.preview(actor, (await params).id, await readBoundedJson(request, 8192));
    });
  },
);
