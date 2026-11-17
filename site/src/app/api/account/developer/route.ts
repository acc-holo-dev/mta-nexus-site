import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../features/accounts/user-platform-api";
import { verificationRate } from "../../../../features/trust/verification-workspace-api";
import { developerProfileUpdateSchema } from "../../../../features/trust/verification-workspace-contract";
import {
  verificationError,
  verificationMutationError,
} from "../../../../features/trust/verification-workspace-copy";
import { readBoundedJson, requireServerJsonContentType } from "../../../../lib/http/bounded-json";
import { withBrowserMutation } from "../../../../lib/http/browser-route-adapter";
import { verificationWorkspaceService } from "../../../../lib/services/moderation/verification-workspace-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.ownProfile(actor);
    },
    200,
    verificationError,
  );
}
export const PATCH = withBrowserMutation((request: NextRequest) => {
  return userPlatformApi(
    request,
    async (actor) => {
      requireServerJsonContentType(request);
      const parsed = developerProfileUpdateSchema.safeParse(await readBoundedJson(request));
      if (!parsed.success) throw new AppError("Invalid profile", 400, "VALIDATION_ERROR");
      await verificationRate(actor.id, "profileEditing");
      const currentToken = request.cookies.get("nexus_session")?.value;
      if (!currentToken) throw new UnauthorizedError();
      return verificationWorkspaceService.updateProfile(actor, parsed.data, currentToken);
    },
    200,
    verificationMutationError,
  );
});
