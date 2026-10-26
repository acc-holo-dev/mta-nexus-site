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
    async (user) => ({
      organization: await organizationWorkspaceService.create(
        await organizationInput(request, user, true),
        user,
      ),
    }),
    201,
  );
});
