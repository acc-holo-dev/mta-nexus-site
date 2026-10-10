import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceLifecycleSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { productService } from "../../../../../lib/services/product-service";

export function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const { id } = await params;
    const parsed = resourceLifecycleSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success)
      throw new AppError("Invalid resource lifecycle command", 400, "RESOURCE_LIFECYCLE_INVALID");
    const product = await productService.transitionResource(id, parsed.data, actor);
    return { product: { id: product.id, status: product.status, updatedAt: product.updatedAt } };
  });
}
