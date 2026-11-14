import type { NextRequest } from "next/server";
import { withBrowserMutation } from "../../../../../../../lib/browser-route-adapter";
import {
  organizationApi,
  organizationId,
  organizationInput,
  organizationMutationToken,
} from "../../../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../../../lib/services/organization-workspace-service";

type Context = { params: Promise<{ id: string; userId: string }> };
function mutation(request: NextRequest, context: Context, remove: boolean) {
  return organizationApi(request, async (user) => {
    const token = organizationMutationToken(request, user);
    const { id, userId } = await context.params;
    return organizationWorkspaceService.change(
      organizationId(id),
      organizationId(userId),
      await organizationInput(request, user),
      user,
      remove,
      token,
    );
  });
}
export const PATCH = withBrowserMutation((request: NextRequest, context: Context) =>
  mutation(request, context, false),
);
export const DELETE = withBrowserMutation((request: NextRequest, context: Context) =>
  mutation(request, context, true),
);
