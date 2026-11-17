import { AppError, UnauthorizedError } from "@nexus/domain";
import { resourceReleaseWatchEnableCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../features/resources/resource-commerce-http";
import { resourceReleaseWatchesQuery } from "../../../../../../features/resources/resource-release-watches-query";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { resourceReleaseWatchesService } from "../../../../../../lib/services/resource-release-watches-service";
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
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      if (request.nextUrl.searchParams.size)
        throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_INVALID");
      const parsed = resourceReleaseWatchEnableCommandSchema.safeParse(
        await readBoundedJson(request, 8192),
      );
      if (!parsed.success) throw new AppError("Invalid watch batch", 400, "RELEASE_WATCH_INVALID");
      return resourceReleaseWatchesService.enableCollectionBatch(
        actor,
        currentToken,
        (await params).id,
        parsed.data,
      );
    });
  },
);
