import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { collectionsQuery } from "../../../../lib/library-collections-query";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../lib/services/library-collections-service";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    libraryCollectionsService.page(actor, collectionsQuery(request.nextUrl.searchParams)),
  );
}
export const POST = withBrowserMutation((request: NextRequest) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected mutation query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.command(actor, await readBoundedJson(request, 2048));
  });
});
