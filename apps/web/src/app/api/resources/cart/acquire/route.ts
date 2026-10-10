import type { NextRequest } from "next/server";
import { AppError } from "@nexus/domain";
import { resourceCartAcquisitionSchema } from "@nexus/validation";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { commerceService } from "../../../../../lib/services/commerce-service";

export function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = resourceCartAcquisitionSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success)
      throw new AppError("Invalid cart acquisition", 400, "RESOURCE_CART_INVALID");
    return commerceService.acquireResourceCart(
      actor,
      parsed.data.productIds,
      parsed.data.requestId,
    );
  });
}
