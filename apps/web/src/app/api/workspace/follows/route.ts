import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { userPlatformApi } from "../../../../lib/user-platform-api";
import { followError } from "../../../../lib/follow-workspace-copy";
import { parseFollowQuery } from "../../../../lib/follow-workspace-contract";
import { followWorkspaceService } from "../../../../lib/services/follow-workspace-service";
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
