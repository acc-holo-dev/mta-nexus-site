import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { commerceService } from "../../../../../lib/services/commerce-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    commerceService.reviewResourceCart(actor),
  );
}
