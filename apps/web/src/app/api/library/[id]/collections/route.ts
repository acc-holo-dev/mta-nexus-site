import { AppError, LIBRARY_COLLECTION_COMMAND_BYTES } from "@nexus/domain";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { libraryCollectionsService } from "../../../../../lib/services/library-collections-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected resource collections query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.resourceMemberships(actor, (await params).id);
  });
}
export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected membership mutation query", 400, "COLLECTION_INVALID");
    return libraryCollectionsService.membershipBatch(
      actor,
      (await params).id,
      await readBoundedJson(request, LIBRARY_COLLECTION_COMMAND_BYTES),
    );
  });
}
