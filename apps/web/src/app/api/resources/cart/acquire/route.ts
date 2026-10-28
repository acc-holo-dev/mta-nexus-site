import { AppError } from "@nexus/domain";
import { resourceCartAcquisitionSchema } from "@nexus/validation";
import type { NextRequest } from "next/server";
import { readBoundedJson } from "../../../../../lib/bounded-json";
import { withBrowserMutation } from "../../../../../lib/browser-route-adapter";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { commerceService } from "../../../../../lib/services/commerce-service";

export const POST = withBrowserMutation(function POST(request: NextRequest) {
  return resourceCommerceRequest(request, true, async (actor) => {
    const parsed = resourceCartAcquisitionSchema.safeParse(await readBoundedJson(request, 4096));
    if (!parsed.success)
      throw new AppError("Invalid cart acquisition", 400, "RESOURCE_CART_INVALID");
    return commerceService.acquireResourceCart(
      actor,
      parsed.data.productIds,
      parsed.data.requestId,
      parsed.data.reviewDigest,
    );
  });
});
