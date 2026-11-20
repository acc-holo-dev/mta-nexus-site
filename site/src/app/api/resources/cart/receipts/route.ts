import type { NextRequest } from "next/server";
import { resourceCartReceiptQuery } from "../../../../../features/resources/resource-cart-receipts-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../lib/services/commerce/resource-cart-receipts-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceCartReceiptsService.page(actor, resourceCartReceiptQuery(request.nextUrl.searchParams)),
  );
}
