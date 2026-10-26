import { AppError, LIBRARY_COLLECTION_COMMAND_BYTES } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { collectionsQuery } from "../../../../../lib/library-collections-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) =>
    libraryCollectionsService.detail(
      actor,
      (await params).id,
      collectionsQuery(request.nextUrl.searchParams, "detail"),
    ),
  );
}
export const POST = withBrowserMutation((request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected mutation query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.command(
      actor,
      await readBoundedJson(request, LIBRARY_COLLECTION_COMMAND_BYTES),
      (await params).id,
    );
  });
});
