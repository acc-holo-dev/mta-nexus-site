import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCartItemSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../lib/resource-commerce-http";
import { commerceService } from "../../../../lib/services/commerce-service";

export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => commerceService.getResourceCart(actor));
}

export function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = resourceCartItemSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success)
      throw new AppError("Invalid resource cart item", 400, "RESOURCE_CART_INVALID");
    await commerceService.addResourceToCart(actor, parsed.data.productId);
    return { productId: parsed.data.productId, inCart: true };
  });
}

export function DELETE(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = resourceCartItemSchema.safeParse(await readBoundedJson(request, 2048));
    if (!parsed.success)
      throw new AppError("Invalid resource cart item", 400, "RESOURCE_CART_INVALID");
    await commerceService.removeResourceFromCart(actor, parsed.data.productId);
    return { productId: parsed.data.productId, inCart: false };
  });
}
