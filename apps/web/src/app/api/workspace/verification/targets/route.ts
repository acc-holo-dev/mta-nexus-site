import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { verificationError } from "../../../../../lib/verification-workspace-copy";
import {
  verificationFilters,
  verificationRate,
} from "../../../../../lib/verification-workspace-api";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = verificationFilters(request.nextUrl.searchParams, true);
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.targets(actor, filters);
    },
    200,
    verificationError,
  );
}
