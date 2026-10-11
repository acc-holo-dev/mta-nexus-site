import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../lib/services/resource-cart-receipts-service";
import { resourceCartReceiptQuery } from "../../../../../lib/resource-cart-receipts-query";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceCartReceiptsService.page(actor, resourceCartReceiptQuery(request.nextUrl.searchParams)),
  );
}
