import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import {
  organizationApi,
  organizationId,
  organizationInput,
} from "../../../../../lib/organization-workspace-api";
import { parseOrganizationPage } from "../../../../../lib/organization-workspace-contract";
import { organizationWorkspaceService } from "../../../../../lib/services/organization-workspace-service";

type Context = { params: Promise<{ id: string }> };
export function GET(request: NextRequest, context: Context) {
  return organizationApi(request, async (user) => {
    const { id } = await context.params;
    const filters = parseOrganizationPage(request.nextUrl.searchParams);
    return organizationWorkspaceService.get(organizationId(id), user, filters.page, filters.query);
  });
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) => {
  return organizationApi(request, async (user) => ({
    organization: await organizationWorkspaceService.update(
      organizationId((await context.params).id),
      await organizationInput(request, user),
      user,
    ),
  }));
});
