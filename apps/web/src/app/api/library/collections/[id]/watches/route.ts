import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceReleaseWatchEnableCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { resourceReleaseWatchesQuery } from "../../../../../../lib/resource-release-watches-query";
import { resourceReleaseWatchesService } from "../../../../../../lib/services/resource-release-watches-service";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const query = resourceReleaseWatchesQuery(request.nextUrl.searchParams);
    return resourceReleaseWatchesService.collectionPage(
      actor,
      (await params).id,
      query.page,
      query.filter,
      query.query,
    );
  });
}
export const POST = withBrowserMutation((request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_INVALID");
    const parsed = resourceReleaseWatchEnableCommandSchema.safeParse(
      await readBoundedJson(request, 8192),
    );
    if (!parsed.success) throw new AppError("Invalid watch batch", 400, "RELEASE_WATCH_INVALID");
    return resourceReleaseWatchesService.enableCollectionBatch(
      actor,
      (await params).id,
      parsed.data,
    );
  });
});
