import { AppError, LIBRARY_COLLECTION_MANIFEST_BYTES } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { libraryCollectionsService } from "../../../../../../lib/services/library-collections-service";
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected import query", 400, "COLLECTION_INVALID");
      return libraryCollectionsService.importPreview(
        actor,
        (await params).id,
        await readBoundedJson(request, LIBRARY_COLLECTION_MANIFEST_BYTES),
      );
    });
  },
);
