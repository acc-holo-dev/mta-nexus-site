import type { NextRequest } from "next/server";
import { resourceCartReceiptQuery } from "../../../../../lib/resource-cart-receipts-query";
import { resourceCommerceRequest } from "../../../../../lib/resource-commerce-http";
import { resourceCartReceiptsService } from "../../../../../lib/services/resource-cart-receipts-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    resourceCartReceiptsService.page(actor, resourceCartReceiptQuery(request.nextUrl.searchParams)),
  );
}
