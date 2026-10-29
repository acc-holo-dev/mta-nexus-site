import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import {
  verificationError,
  verificationMutationError,
} from "../../../../lib/verification-workspace-copy";
import { verificationApplicationSchema } from "../../../../lib/verification-workspace-contract";
import { verificationFilters, verificationRate } from "../../../../lib/verification-workspace-api";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";

export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = verificationFilters(request.nextUrl.searchParams);
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.overview(actor, filters);
    },
    200,
    verificationError,
  );
}
export const POST = withBrowserMutation(async (request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      requireServerJsonContentType(request);
      const parsed = verificationApplicationSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid application", 400, "VALIDATION_ERROR");
      await verificationRate(actor.id, "verification");
      // Moderator inbox fanout is committed with the request; no after() dispatch.
      return verificationWorkspaceService.apply(actor, parsed.data);
    },
    201,
    verificationMutationError,
  );
});
