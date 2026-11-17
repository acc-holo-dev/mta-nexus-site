import type { NextRequest } from "next/server";
import { orderCaseQuery } from "../../../../../features/commerce/order-case-query";
import { resourceCommerceRequest } from "../../../../../features/resources/resource-commerce-http";
import { orderCaseService } from "../../../../../lib/services/order-case-service";
export function GET(request: NextRequest) {
  return resourceCommerceRequest(request, false, (actor) => {
    const query = orderCaseQuery(request.nextUrl.searchParams, true);
    return orderCaseService.page(actor, true, query.page, query);
  });
}
