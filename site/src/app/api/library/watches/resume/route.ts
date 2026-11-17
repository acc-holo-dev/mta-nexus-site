import { AppError, UnauthorizedError } from "@nexus/domain";
import { resourceReleaseWatchResumeCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
export const POST = withBrowserMutation((request: NextRequest) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const currentToken = request.cookies.get("nexus_session")?.value;
    if (!currentToken) throw new UnauthorizedError();
    if (request.nextUrl.searchParams.size)
      throw new AppError("Invalid watch query", 400, "RELEASE_WATCH_INVALID");
    const parsed = resourceReleaseWatchResumeCommandSchema.safeParse(
      await readBoundedJson(request, 8192),
    );
    if (!parsed.success) throw new AppError("Invalid watch batch", 400, "RELEASE_WATCH_INVALID");
    return resourceReleaseWatchesService.resumeBatch(actor, currentToken, parsed.data);
  });
});
