import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseOrganizationChangeHistoryQuery } from "../../../../../../lib/organization-governance-contract";
import { organizationGovernanceError } from "../../../../../../lib/organization-governance-copy";
import { organizationId } from "../../../../../../lib/organization-workspace-api";
import { organizationGovernanceService } from "../../../../../../lib/services/organization-governance-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseOrganizationChangeHistoryQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid history filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return organizationGovernanceService.history(
        organizationId((await context.params).id),
        actor,
        filters.before,
        filters,
      );
    },
    200,
    organizationGovernanceError,
  );
}
