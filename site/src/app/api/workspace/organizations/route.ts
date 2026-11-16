import { AppError, UnauthorizedError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../lib/browser-route-adapter";
import { organizationApi, organizationInput } from "../../../../lib/organization-workspace-api";
import { parseOrganizationPage } from "../../../../lib/organization-workspace-contract";
import { organizationWorkspaceService } from "../../../../lib/services/organization-workspace-service";
export function GET(request: NextRequest) {
  return organizationApi(request, async (user) => {
    const filters = parseOrganizationPage(request.nextUrl.searchParams);
    return organizationWorkspaceService.list(user, filters.page, filters.query);
  });
}
export const POST = withBrowserMutation((request: NextRequest) => {
  return organizationApi(
    request,
    async (user) => {
      const expected = request.headers.get("x-nexus-actor-id");
      if (!expected) throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expected !== user.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
      const nonce = request.headers.get("x-nexus-creation-nonce");
      if (!nonce || !/^[a-f0-9]{32}$/u.test(nonce))
        throw new AppError("Invalid creation nonce", 400, "VALIDATION_ERROR");
      const token = request.cookies.get("nexus_session")?.value;
      if (!token) throw new UnauthorizedError();
      return {
        organization: await organizationWorkspaceService.create(
          await organizationInput(request, user, true),
          user,
          token,
          nonce,
        ),
      };
    },
    201,
  );
});
