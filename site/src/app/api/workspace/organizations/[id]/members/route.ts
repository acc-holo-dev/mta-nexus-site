import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../features/organizations/organization-workspace-api";
import { withBrowserMutation } from "../../../../../../lib/http/browser-route-adapter";
import { organizationWorkspaceService } from "../../../../../../lib/services/organizations/organization-workspace-service";
export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return organizationApi(
      request,
      async (user) => {
        const token = organizationMutationToken(request, user);
        return organizationWorkspaceService.add(
          organizationId((await context.params).id),
          await organizationInput(request, user),
          user,
          token,
        );
      },
      201,
    );
  },
);
