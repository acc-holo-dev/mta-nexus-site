import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { commerceService } from "../../../../../lib/services/commerce/commerce-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    commerceService.reviewResourceCart(actor),
  );
}
