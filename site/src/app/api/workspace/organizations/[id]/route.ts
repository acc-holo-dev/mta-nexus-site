import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationCheckReadActor,
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../features/organizations/organization-workspace-api";
import { parseOrganizationPage } from "../../../../../features/organizations/organization-workspace-contract";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { organizationWorkspaceService } from "../../../../../lib/services/organization-workspace-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return organizationApi(request, async (user) => {
    organizationCheckReadActor(request, user);
    const { id } = await context.params;
    const filters = parseOrganizationPage(request.nextUrl.searchParams);
    return organizationWorkspaceService.get(organizationId(id), user, filters.page, filters.query);
  });
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) => {
  return organizationApi(request, async (user) => {
    const token = organizationMutationToken(request, user);
    return {
      organization: await organizationWorkspaceService.update(
        organizationId((await context.params).id),
        await organizationInput(request, user),
        user,
        token,
      ),
    };
  });
});
