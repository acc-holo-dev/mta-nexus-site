import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceBuildCommandSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../../lib/resource-commerce-http";
import { resourceBuildWorkspaceService } from "../../../../../../lib/services/resource-build-workspace-service";
import { withBrowserMutation } from "../../../../../../lib/browser-route-adapter";
type Context = { params: Promise<{ id: string; buildId: string }> };
export function GET(request: NextRequest, { params }: Context) {
  return resourceCommerceRequest(request, false, async actor => {
    const { id, buildId } = await params;
    return resourceBuildWorkspaceService.detail(id, buildId, actor);
  });
}
export const PATCH = withBrowserMutation((request: NextRequest, { params }: Context) => {
  return resourceCommerceRequest(request, true, async actor => {
    const parsed = resourceBuildCommandSchema.safeParse(await readBoundedJson(request, 49152));
    if (!parsed.success) throw new AppError("Invalid version command", 400, "BUILD_COMMAND_INVALID");
    const { id, buildId } = await params;
    return { build: await resourceBuildWorkspaceService.command(id, buildId, parsed.data, actor) };
  });
});
