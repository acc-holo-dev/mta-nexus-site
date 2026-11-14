import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../../../lib/resource-commerce-http";
import { resourceBuildWorkspaceService } from "../../../../../../../lib/services/resource-build-workspace-service";
export function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; buildId: string }> },
) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id, buildId } = await params;
    return resourceBuildWorkspaceService.detail(id, buildId, actor, true);
  });
}
