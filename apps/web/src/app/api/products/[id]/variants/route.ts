import { AppError } from "@nexus/domain";
import { resourceVariantCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id } = await params;
    return resourceManagementService.managedVariants(id, actor);
  });
}
export const POST = withBrowserMutation((request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  return resourceCommerceRequest(request, true, async (actor) => {
    const { id } = await params;
    const parsed = resourceVariantCommandSchema.safeParse(await readBoundedJson(request, 16_384));
    if (!parsed.success)
      throw new AppError("Invalid variant command", 400, "RESOURCE_VARIANTS_INVALID");
    return resourceManagementService.saveVariants(id, actor, parsed.data);
  });
});
