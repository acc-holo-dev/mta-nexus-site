import type { NextRequest } from "next/server";
import { AppError, RateLimitExceededError } from "@nexus/domain";
import { consumeRateLimit } from "@nexus/security";
import { userPlatformApi } from "../../../../../../lib/user-platform-api";
import { parseOrganizationTeamQuery } from "../../../../../../lib/organization-team-contract";
import { organizationTeamError } from "../../../../../../lib/organization-team-copy";
import { organizationTeamService } from "../../../../../../lib/services/organization-team-service";
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return userPlatformApi(
    request,
    async (actor) => {
      const filters = parseOrganizationTeamQuery(request.nextUrl.searchParams);
      if (!filters) throw new AppError("Invalid team filters", 400, "VALIDATION_ERROR");
      if (!(await consumeRateLimit("search", actor.id)).success) throw new RateLimitExceededError();
      return organizationTeamService.page((await params).id, actor, filters);
    },
    200,
    organizationTeamError,
  );
}
