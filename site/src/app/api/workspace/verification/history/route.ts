import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { userPlatformApi } from "../../../../../features/accounts/user-platform-api";
import { verificationApplicationsError } from "../../../../../features/moderation/verification-applications-copy";
import { parseVerificationApplicationsQuery } from "../../../../../features/trust/verification-applications-contract";
import { verificationRate } from "../../../../../features/trust/verification-workspace-api";
import { verificationWorkspaceService } from "../../../../../lib/services/moderation/verification-workspace-service";
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
