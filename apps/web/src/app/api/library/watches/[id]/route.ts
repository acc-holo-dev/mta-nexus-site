import type { NextRequest } from "next/server";
import { AppError, UnauthorizedError } from "@nexus/domain";
import { resourceReleaseWatchCommandSchema } from "@nexus/validation";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceReleaseWatchesService } from "../../../../../lib/services/resource-release-watches-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (user) => {
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected watch scope", 400, "RELEASE_WATCH_INVALID");
    return resourceReleaseWatchesService.detail(user, (await params).id);
  });
}
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (user) => {
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected watch scope", 400, "RELEASE_WATCH_INVALID");
      const command = resourceReleaseWatchCommandSchema.safeParse(
        await readBoundedJson(request, 2048),
      );
      if (!command.success)
        throw new AppError("Invalid release preference", 400, "RELEASE_WATCH_INVALID");
      return resourceReleaseWatchesService.command(
        user,
        currentToken,
        (await params).id,
        command.data,
      );
    });
  },
);
