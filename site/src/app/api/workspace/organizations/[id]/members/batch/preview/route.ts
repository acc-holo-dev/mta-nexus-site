import { AppError } from "@nexus/domain";
import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../../../features/organizations/organization-workspace-api";
import { withBrowserMutation } from "../../../../../../../../lib/http/browser-route-adapter";
import { organizationWorkspaceService } from "../../../../../../../../lib/services/organizations/organization-workspace-service";

type Context = { params: Promise<{ id: string }> };
export const POST = withBrowserMutation((request: NextRequest, { params }: Context) => {
  return organizationApi(request, async (user) => {
    const token = organizationMutationToken(request, user);
    if (request.nextUrl.searchParams.size)
      throw new AppError("Unexpected filters", 400, "VALIDATION_ERROR");
    return organizationWorkspaceService.previewMembers(
      organizationId((await params).id),
      await organizationInput(request, user),
      user,
      token,
    );
  });
});
