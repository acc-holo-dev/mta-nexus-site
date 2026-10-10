import type { NextRequest } from "next/server";
import { organizationApi, organizationInput } from "../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../lib/services/organization-workspace-service";
import { parseOrganizationPage } from "../../../../lib/organization-workspace-contract";
export function GET(request: NextRequest) {
  return organizationApi(request, async (user) => {
    const filters = parseOrganizationPage(request.nextUrl.searchParams);
    return organizationWorkspaceService.list(user, filters.page, filters.query);
  });
}
export function POST(request: NextRequest) {
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
}
