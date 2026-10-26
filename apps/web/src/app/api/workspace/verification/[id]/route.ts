import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../../lib/bounded-json";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { verificationApplicationsError } from "../../../../../lib/verification-applications-copy";
import { verificationRate } from "../../../../../lib/verification-workspace-api";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected detail filters", 400, "VALIDATION_ERROR");
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.application(actor, (await context.params).id);
    },
    200,
    verificationApplicationsError,
  );
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) => {
  return userPlatformApi(
    request,
    async (actor) => {
      if (request.nextUrl.searchParams.size)
        throw new AppError("Unexpected amendment filters", 400, "VALIDATION_ERROR");
      requireServerJsonContentType(request);
      await verificationRate(actor.id, "verification");
      return verificationWorkspaceService.amend(
        actor,
        (await context.params).id,
        await readBoundedJson(request, 16384),
      );
    },
    200,
    verificationApplicationsError,
  );
});
