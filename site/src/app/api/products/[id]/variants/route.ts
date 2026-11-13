import { AppError } from "@nexus/domain";
import { resourceVariantCommandSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";

export function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, false, async (actor) => {
    const { id } = await params;
    const value = await resourceManagementService.managedVariants(id, actor);
    return Response.json(value, { headers: { "X-Nexus-Actor-Id": actor.id } });
  });
}
export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (!expectedActor)
        throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expectedActor !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
      const { id } = await params;
      const parsed = resourceVariantCommandSchema.safeParse(await readBoundedJson(request, 16_384));
      if (!parsed.success)
        throw new AppError("Invalid variant command", 400, "RESOURCE_VARIANTS_INVALID");
      return resourceManagementService.saveVariants(id, actor, parsed.data);
    });
  },
);
