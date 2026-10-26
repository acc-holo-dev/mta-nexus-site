import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
import {
  organizationApi,
  organizationId,
  organizationInput,
} from "../../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../../lib/services/organization-workspace-service";
export const POST = withBrowserMutation(
  (request: NextRequest, context: { params: Promise<{ id: string }> }) => {
    return organizationApi(
      request,
      async (user) =>
        organizationWorkspaceService.add(
          organizationId((await context.params).id),
          await organizationInput(request, user),
          user,
        ),
      201,
    );
  },
);
