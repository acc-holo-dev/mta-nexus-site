import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  verificationFilters,
  verificationRate,
} from "../../../../../lib/verification-workspace-api";
import { verificationError } from "../../../../../features/trust/verification-workspace-copy";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
export async function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const expected = request.headers.get("x-nexus-actor-id");
      if (expected !== null && expected !== actor.id)
        throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
      const filters = verificationFilters(request.nextUrl.searchParams, true);
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.targets(actor, filters);
    },
    200,
    verificationError,
  );
}
