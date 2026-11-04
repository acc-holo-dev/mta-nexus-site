import { AppError, NotFoundError } from "@nexus/domain";
import { resourceCompatibilitySchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { productService } from "../../../../../lib/services/product-service";
import { resourceManagementService } from "../../../../../lib/services/resource-management-service";

export const GET = (request: NextRequest, { params }: { params: Promise<{ id: string }> }) =>
  resourceCommerceRequest(request, false, async (actor) => {
    const { id } = await params;
    const product = await productService.getManagedProduct(id, actor);
    if (!product) throw new NotFoundError("Product", id);
    return {
      actorId: actor.id,
      product: {
        id: product.id,
        updatedAt: new Date(product.updatedAt).toISOString(),
        compatibility: {
          ...(product.compatibility.mtaMinVersion !== undefined
            ? { mtaMinVersion: product.compatibility.mtaMinVersion }
            : {}),
          dependencies: product.compatibility.dependencies ?? [],
        },
        suspended: product.status === "suspended" || product.status === "archived",
      },
    };
  });

export const POST = withBrowserMutation(
  (request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    return resourceCommerceRequest(request, true, async (actor) => {
      const expectedActor = request.headers.get("x-nexus-actor-id");
      if (!expectedActor)
        throw new AppError("Actor precondition required", 428, "ACTOR_ID_REQUIRED");
      if (expectedActor !== actor.id) throw new AppError("Actor changed", 409, "ACTOR_CHANGED");
      const { id } = await params;
      const parsed = resourceCompatibilitySchema.safeParse(await readBoundedJson(request, 8192));
      if (!parsed.success)
        throw new AppError("Invalid compatibility", 400, "RESOURCE_COMPATIBILITY_INVALID");
      return {
        product: await resourceManagementService.updateCompatibility(id, actor, parsed.data),
      };
    });
  },
);
