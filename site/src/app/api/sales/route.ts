import type { NextRequest } from "next/server";
import { sellerSalesQuery } from "../../../features/commerce/seller-sales-query";
import { resourceCommerceRequest } from "../../../features/resources/resource-commerce-http";
import { sellerSalesService } from "../../../lib/services/commerce/seller-sales-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    sellerSalesService.report(actor, sellerSalesQuery(request.nextUrl.searchParams)),
  );
}
