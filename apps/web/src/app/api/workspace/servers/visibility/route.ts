import { AppError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { serverWorkspaceError } from "../../../../../lib/server-workspace-copy";
import { serverService } from "../../../../../lib/services/server-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
export const POST = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected filters", 400, "SERVER_BATCH_INVALID");
      requireServerJsonContentType(request);
      if (!(await consumeRateLimit("serverMutation", actor.id)).success)
        throw new AppError("Server update limit exceeded", 429, "RATE_LIMIT_EXCEEDED");
      return serverService.saveVisibility(actor, await readBoundedJson(request, 8192));
    },
    200,
    serverWorkspaceError,
  );
});
