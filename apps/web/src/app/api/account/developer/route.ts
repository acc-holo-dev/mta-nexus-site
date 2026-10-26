import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import {
  verificationError,
  verificationMutationError,
} from "../../../../lib/verification-workspace-copy";
import { developerProfileUpdateSchema } from "../../../../lib/verification-workspace-contract";
import { requireServerJsonContentType, readBoundedJson } from "../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { verificationRate } from "../../../../lib/verification-workspace-api";
import { verificationWorkspaceService } from "../../../../lib/services/verification-workspace-service";
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
      return verificationWorkspaceService.updateProfile(actor, parsed.data);
    },
    200,
    verificationMutationError,
  );
});
