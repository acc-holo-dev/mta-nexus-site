import type { NextRequest } from "next/server";
import {
  organizationApi,
  organizationInput,
  organizationId,
} from "../../../../../../lib/organization-workspace-api";
import { organizationWorkspaceService } from "../../../../../../lib/services/organization-workspace-service";
export function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
}
