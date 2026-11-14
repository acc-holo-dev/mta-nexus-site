import type { NextRequest } from "next/server";
import { resourceCommerceRequest } from "../../../lib/resource-commerce-http";
import { sellerSalesQuery } from "../../../lib/seller-sales-query";
import { sellerSalesService } from "../../../lib/services/seller-sales-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) =>
    sellerSalesService.report(actor, sellerSalesQuery(request.nextUrl.searchParams)),
  );
}
