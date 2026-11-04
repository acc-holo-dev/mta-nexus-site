import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { verificationFilters, verificationRate } from "../../../../lib/verification-workspace-api";
import { verificationApplicationSchema } from "../../../../lib/verification-workspace-contract";
import {
  verificationError,
  verificationMutationError,
} from "../../../../lib/verification-workspace-copy";

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
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      // Moderator inbox fanout is committed with the request; no after() dispatch.
      return verificationWorkspaceService.apply(actor, parsed.data, currentToken);
    },
    201,
    verificationMutationError,
  );
});
