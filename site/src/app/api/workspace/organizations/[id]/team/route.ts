import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import type { NextRequest } from "next/server";
import { parseOrganizationTeamQuery } from "../../../../../../features/organizations/organization-team-contract";
import { organizationTeamError } from "../../../../../../features/organizations/organization-team-copy";
import { organizationCheckReadActor } from "../../../../../../lib/organization-workspace-api";
import { organizationTeamService } from "../../../../../../lib/services/organization-team-service";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      organizationCheckReadActor(request, actor);
      const filters = parseOrganizationTeamQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid team filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return organizationTeamService.page((await params).id, actor, filters);
    },
    200,
    organizationTeamError,
  );
}
