import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../features/organizations/organization-workspace-api";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import { organizationWorkspaceService } from "../../../../../../lib/services/organization-workspace-service";
export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return organizationApi(request, async (user) => {
      const token = organizationMutationToken(request, user);
      return organizationWorkspaceService.leave(
        organizationId((await context.params).id),
        await organizationInput(request, user),
        user,
        token,
      );
    });
  },
);
