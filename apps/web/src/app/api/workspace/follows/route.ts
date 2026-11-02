import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { parseFollowQuery } from "../../../../lib/follow-workspace-contract";
import { followError } from "../../../../lib/follow-workspace-copy";
import { followWorkspaceService } from "../../../../lib/services/follow-workspace-service";
import { userPlatformApi } from "../../../../lib/user-platform-api";
export function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseFollowQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid follow filters", 400, "VALIDATION_ERROR");
      return followWorkspaceService.page(actor.id, filters);
    },
    200,
    followError,
  );
}
