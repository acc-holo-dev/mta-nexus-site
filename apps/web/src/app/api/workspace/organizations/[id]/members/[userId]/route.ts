import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationInput,
  organizationId,
} from "../../../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../../../lib/services/organization-workspace-service";
type Context = { params: Promise<{ id: string; userId: string }> };
function mutation(request: NextRequest, context: Context, remove: boolean) {
  return organizationApi(request, async (user) => {
    const { id, userId } = await context.params;
    return organizationWorkspaceService.change(
      organizationId(id),
      organizationId(userId),
      await organizationInput(request, user),
      user,
      remove,
    );
  });
}
export function PATCH(request: NextRequest, context: Context) {
  return mutation(request, context, false);
}
export function DELETE(request: NextRequest, context: Context) {
  return mutation(request, context, true);
}
