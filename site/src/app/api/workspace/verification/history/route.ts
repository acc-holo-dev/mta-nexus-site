import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { verificationWorkspaceService } from "../../../../../lib/services/verification-workspace-service";
import { userPlatformApi } from "../../../../../lib/user-platform-api";
import { parseVerificationApplicationsQuery } from "../../../../../lib/verification-applications-contract";
import { verificationApplicationsError } from "../../../../../lib/verification-applications-copy";
import { verificationRate } from "../../../../../lib/verification-workspace-api";
export function GET(request: NextRequest) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseVerificationApplicationsQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid application filters", 400, "VALIDATION_ERROR");
      await verificationRate(actor.id, "search");
      return verificationWorkspaceService.applications(actor, filters);
    },
    200,
    verificationApplicationsError,
  );
}
